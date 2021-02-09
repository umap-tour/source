import * as d3 from 'd3';
import * as utils from '../utils/utils';
import {initGL} from '../utils/gl_utils';
import {update_data, update_uniform, update_uniform_i, clear} from '../utils/gl_utils';
import {init_attribute, init_buffer_with_data, update_attribute} from '../utils/gl_utils';
import * as numeric from 'numeric';
import GrandTourCore from '../cores/GrandTourCore';
import GrandTourBrushController from '../controllers/GrandTourBrushController';

import vShaderScript from '../shaders/gt_vertex.glsl';
import fShaderScript from '../shaders/fragment.glsl';


const image_orientation = require('../states/orientations/0-image.json');
const animal_orientation = require('../states/orientations/12-animal.json');
const human_orientation = require('../states/orientations/12-human.json');
window.image_orientation = image_orientation;
window.animal_orientation = animal_orientation;
window.human_orientation = human_orientation;


let screen_size = Math.min(window.innerWidth, window.innerHeight);
window.utils = utils;
  
export default class GrandTourInTheShaderView{
  constructor(
    canvas, 
    data_shape, 
    epoch_arch_to_dir, 
    imageUrls, 
    attributeUrl, options,
    epochIndex, archIndex, layerIndex, 
    styles
  ){
    
    this.epoch_arch_to_dir = epoch_arch_to_dir;
    this.setSampleIndices(data_shape, imageUrls);

    this.viewId = canvas.node().id.split('-').reverse()[0];

    this.ndim = data_shape[1];
    this.imageUrls = imageUrls;
    this.attributeUrl = attributeUrl;
    this.options = options;
    this.currentAttribute = '';

    this.styles = styles || {};
    this.styles.opacity = {
      'handle': 0.15,
      'handleLine': 0.5,
      'handleText': 0.75,

      'legend': 1.0,
      'resetZoom': 1.0,
      'fps': 0.9,
    };
    this.styles.marginRight = this.styles.marginRight || 50;
    this.styles.marginBottom = this.styles.marginBottom || 50;
    this.styles.resetRadius = this.styles.resetRadius || 20;

    if(this.styles.defaultUI === undefined){
      let defaultUI = [
        'attribute', 'help', 'handle', 
        'legend', 'resetZoom', 'fps', 
        'zoom', 'layer'
      ];
      let epochs = new Set(Object.keys(this.epoch_arch_to_dir).map(d=>+d.split(',')[0]));
      if(epochs.size > 1){
        defaultUI.push('epoch');
      }
      this.styles.defaultUI =  defaultUI;
    }

    this.bg_color = this.styles.bg_color || utils.CLEAR_COLOR;

    this.dataObj = {};
    this.epochs = Array.from(new Set(Object.keys(this.epoch_arch_to_dir).map(d=>+d.split(',')[0]))).sort((a,b)=>a-b);



    this.pointSize = (this.styles.pointSize || 2) / Math.sqrt(969) * Math.sqrt(screen_size);
    this.pixelSize = (this.styles.pixelSize || 2) / Math.sqrt(969) * Math.sqrt(screen_size);
    this.canvas = canvas;
    this.isUiEnabled = true;

    this.zoomFactor = 1.0;
    this.transform = d3.zoomIdentity;


    this.shouldShowBasicHandle = false;
    this.handleData = [];
    this.annotationData = [];
    this.annotationHandleData = [];

    

    if(this.shouldShowBasicHandle === true){
      this.handleData = (
        math.identity(this.ndim)._data
        .map(d=>{
          return {centroid:d, selection: []}
        })
      ).concat(handleData);
    }

    this.pointMode = this.styles.pointMode || 'point';
    this.brushMode = 'filter';

    this.isTextureInit = false;
    this.archTransitionTime = 700; //in ms
    this.layerTransitionTime = 700; //in ms
    this.epochTransitionTime = 700; //in ms
    this.shouldRender = true;
    this.progress = 1.0;

    this.selectedLabels = new Set();

    let [width, height] = this.getWidthHeight();
    this.svg = d3.select(this.canvas.node().parentElement).append('svg');
    this.svg.append('defs').node().innerHTML = utils.whiteOutline();
    this.svg
    .attr('id', canvas.attr('id') + '-overlay')
    .attr('class', 'overlay')
    .attr('width', this.canvas.node().clientWidth)
    .attr('height', this.canvas.node().clientHeight)
    .on('mouseover', ()=>{
      //avoid showing brush on the inactive one of side-by-side views
      this.isMouseOn = true;
      // if(this.anotherView !== undefined){
      //   this.alignmentMode = 'leader';
      //   this.anotherView.alignmentMode = 'follower';
      // }
    })
    .on('mouseout', ()=>{
      this.isMouseOn = false;
    });

    this.handleTextOverlay = d3.select(this.canvas.node().parentElement)
    // .insert('div', '#'+this.svg.attr('id'))
    .append('div')
    .attr('class', 'handleTextOverlay')
    .style('position', 'relative');

    this.controlOverlay = d3.select(this.canvas.node().parentElement)
    .append('div')
    .attr('class', 'controlOverlay')
    .style('position', 'absolute');

    this.fpsText = this.svg.selectAll('#fps')
    .data([0])
    .enter()
    .append('text')
    .attr('id', 'fps')
    .attr('fill', utils.TEXT_COLOR)
    .attr('display', this.styles.defaultUI.indexOf('fps')>=0?'':'none')
    // .style('alignment-baseline', 'hanging')
    // .style('alignment-baseline', 'baseline')
    .style('alignment-baseline', 'middle')
    // .style('text-anchor', 'end');
    this.repositionFps();

    //zoom
    this.zoom = d3.zoom()
    .scaleExtent([0.1, 150])
    // .translateExtent([[-width,-height], [width*2, height*2]])
    .on('start', ()=>{
      this.shouldRender0_zoom = this.shouldRender;
      this.shouldRender = true;
    })
    .on('zoom', ()=>{
      this.transform = d3.event.transform;
      this.zoomFactor = this.transform.k;
      update_uniform(this.gl, 'point_size', this.pointSize*Math.sqrt(this.zoomFactor)*devicePixelRatio);
      update_uniform(this.gl, 'min_size', this.pointSize/2*Math.sqrt(this.zoomFactor)*devicePixelRatio);
      update_uniform(this.gl, 'zoom_factor', this.zoomFactor);
      this.updateScale(this.scales);

      // if(this.anotherView !== undefined && this.isMouseOn){
      //   this.anotherView.svg
      //   .transition()
      //   .duration(1)
      //   .call( this.anotherView.zoom.transform, this.transform);
      // }
    })
    .on('end', ()=>{
      this.shouldRender = this.shouldRender0_zoom;
    });
    // if(this.styles.zoom !== false){
      this.svg.call(this.zoom);
    // }


    //todo: generalize it by passing a parameter(container) to the constructor 
    this.epochLabel = d3.select('#epochLabel')
    .style('display', this.styles.defaultUI.indexOf('epoch')>=0?'':'none')
    .style('color', utils.TEXT_COLOR);

    this.epochSlider = d3.select('#epochSlider') 
    .attr('min', 0)
    .attr('max', this.epochs.length-1)
    .attr('step', 0.05)
    .style('position', 'absolute')
    .style('display', this.styles.defaultUI.indexOf('epoch')>=0?'':'none')
    .on('input', (value)=>{
      value = value || +this.epochSlider.node().value;
      let [epochIndexFloor, epochIndexCeil] = utils.getFloorCeil(this.epochs, value);
      let progress;
      if(epochIndexFloor === null){
        epochIndexFloor = epochIndexCeil;
        progress = 0.0;
      }else{
        progress = (value - epochIndexFloor) / (epochIndexCeil-epochIndexFloor);
      }
      this.setFloatEpochArchLayer(
        epochIndexFloor, epochIndexCeil,
        this.archIndex, this.archIndex,
        this.layerIndex, this.layerIndex,
        progress
      );

      //update handle centroid
      this.handleData = this.handleData.map(d=>{
        if(d.selection.length > 0){
          let data0 = this.dataObj[epochIndexFloor][this.archIndex][this.layerIndex];
          let data1 = this.dataObj[epochIndexCeil][this.archIndex][this.layerIndex];
          d.centroid = math.mean(
            d.selection.map(i=>math.mean([data0[i], data1[i]], 0)), 
            0
          );
          // let dataPrev = this.dataObj[this.epochIndex][this.archIndex][this.layerIndexPrev];//bug?
          let dataPrev = this.dataObj[this.epochIndexPrev][this.archIndex][this.layerIndex];
          d.centroidPrev = math.mean(d.selection.map(i=>dataPrev[i]), 0);
        }
        return d;
      });
      this.updateHandlePosition();
      this.epochLabel
      .text(`Epoch: ${value}`);

      // if(this.currentOption === 'movement'){
      //   this.setAttribute('movement');
      // }else if(this.currentOption === 'difference'){
      //   this.setAttribute('difference');
      //   this.anotherView.setAttribute('difference');
      // }
      
    })
    .on('change', (value)=>{
      //snap to int epochs
      value = value || Math.round(+this.epochSlider.node().value);
      this.setFloatEpochArchLayer(
        value, value,
        this.archIndex, this.archIndex,
        this.layerIndex, this.layerIndex,
        1.0
      );
      this.epochIndex = value;
      //update handle centroid
      this.handleData = this.handleData.map(d=>{
        if(d.selection.length > 0){
          let data = this.dataObj[this.epochIndexPrev][this.archIndex][this.layerIndex];
          d.centroid = math.mean(d.selection.map(i=>data[i]), 0);
          let dataPrev = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
          d.centroidPrev = math.mean(d.selection.map(i=>dataPrev[i]), 0);
        }
        return d;
      });
      this.updateHandlePosition();
      this.epochLabel.text(`Epoch: ${value}`);
      this.epochSlider.node().value = value;

      
    
      

    });





    this.sx = d3.scaleLinear();
    this.sy = d3.scaleLinear();
    
    this.gt = new GrandTourCore(this.ndim, this.styles.gtStepSize);
    this.gt.STEPSIZE0 = this.gt.STEPSIZE;
    this.brushController = new GrandTourBrushController(this);

    this.alignmentMode = undefined;

    this.preprocess = math.identity(this.ndim)._data;
    this.procrustes = math.identity(this.ndim)._data;
    this.procrustesPrev = math.identity(this.ndim)._data;
    this.postprocess = math.identity(this.ndim)._data;

    // this.handleScale = 0.5;

    this.initGL();
    this.setEpochArchLayer(epochIndex, archIndex, layerIndex);
    this.initUI();
    
  }
  

  setSampleIndices(data_shape, imageUrls){
    this.sampleSize = utils.isMobile() ? 12000 : data_shape[0];
    this.sampleIndices = utils.sample(data_shape[0], this.sampleSize);
    this.sampleIndexSet = new Set(this.sampleIndices);
    this.s2i = {};
    for(let i=0; i<this.sampleIndices.length; i++){
      let s = this.sampleIndices[i];
      this.s2i[s] = i;
    }
    // let batchSize = 128*128;
    // this.batch = [];
    // for(let i=0; i<imageUrls.length; i++){
    //   let a = batchSize*i;
    //   let b = batchSize*(i+1);
    //   let start = null;
    //   let count = 0;
    //   for(let j=0;j<this.sampleIndices.length; j++){ //linear search, TODO: binary search
    //     let k = this.sampleIndices[j];
    //     if(k >= a && k < b){
    //       if(start === null){
    //         start = j;
    //       }
    //       count += 1;
    //     }
    //     if(k >= b || j==this.sampleIndices.length-1 ){
    //       this.batch[i] = {
    //         start: start,
    //         count: count
    //       };
    //       break;
    //     }
    //   }
    // }
  }


  initUI(){
    // this.initColorScale();
    this.initBrush();
    this.initHandle(this.handleData);
    this.initResetZoomButton();
    this.initHelpButton();
    // this.setUI(this.styles.defaultUI || ['handle', 'legend', 'resetZoom', 'fps', 'zoom']);
    this.enableKeyboardShortcut();
  }

  initHelpButton(){
    if (this.styles.defaultUI.indexOf('help')< 0){
      return;
    }

    let text = [
    'Zoom & pan with mouse',
    '[i] - Toggle between [i]mage/point', 
    '[d] - Create a handle',
    '[x] - Delete a handle',
    '[p] - [P]ause/play Grand Tour',
    '[f] - [F]ilter points with brush',
    '[c] - [C]ancel filtering',
    ];


    if(this.help === undefined){
      this.help = this.svg
      .append('g')
      .attr('class', 'help');

      this.helpButtonGroup = this.help
      .append('g')
      .attr('class', 'helpButtonGroup');
      this.helpButton = this.helpButtonGroup
      .append('circle')
      .attr('class', 'helpButton');
      this.helpButtonText = this.helpButtonGroup
      .append('text')
      .attr('class', 'helpButtonText')
      .attr('fill', utils.TEXT_COLOR)
      .text('?');

      this.helpInfoGroup = this.help
      .append('g')
      .attr('class', 'helpInfoGroup')
      .attr('display', 'none')
      .style('z-index', 10);
      this.helpInfoRect = this.helpInfoGroup
      .append('rect')
      .attr('class', 'helpInfoRect')
      .attr('fill', utils.BG_COLOR)
      .attr('opacity', 0.85);
      this.helpInfoText = this.helpInfoGroup
      .selectAll('text')
      .data(text)
      .enter()
      .append('text')
      .attr('class', 'helpButtonText')
      .attr('fill', '#333')
      .style('font-family', '"Lucida Console", Monaco, monospace')
      .style('font-size', '0.8rem')
      .style('alignment-baseline', 'middle')
      .text(d=>d);
    }

    let [width, height] = this.getWidthHeight();
    let radius = 16/800*height;
    let margin = this.styles.marginRight - radius;
    //translate
    let tx = width - margin - 2*radius;
    let ty = margin;
    this.helpButtonGroup
    .attr('transform', `translate(${tx}, ${ty})`)
    .on('mouseover', ()=>{
      this.helpInfoGroup.attr('display', '');
    })
    .on('mouseout', ()=>{
      this.helpInfoGroup.attr('display', 'none');
    })
    .on('click', ()=>{
      //toggle display
      // let display = this.helpInfoGroup.attr('display');
      // display = display === 'none' ? '' : 'none';
      // this.helpInfoGroup.attr('display', display);
    });
    this.helpButton
    .attr('cx', radius)
    .attr('cy', radius)
    .attr('r', radius)
    .attr('fill', '#d4d4d49c')
    .attr('stroke', '#eee')
    .attr('stroke-width', 0);
    this.helpButtonText
    .attr('x', radius)
    .attr('y', radius)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline','middle');

    let fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    let textLength = d3.max(text, d=>d.length);
    let paddingLeft = fontSize*1;
    let paddingTop = fontSize*1.5;
    let w = fontSize*textLength*0.5 + paddingLeft*2;
    let h = fontSize*text.length + paddingTop*2;

    let left = tx - w;
    let top = ty + 2*radius;

    this.helpInfoGroup
    .attr('transform', `translate(${left},${top})`);
    this.helpInfoRect
    .attr('width', w)
    .attr('height', h)
    .attr('rx', 8);

    let sx = d3.scaleLinear()
    .domain([0,1])
    .range([paddingLeft, this.helpInfoRect.attr('width') - paddingLeft]);
    let sy = d3.scaleLinear()
    .domain([0, text.length-1])
    .range([paddingTop, paddingTop+fontSize*text.length]);
    this.helpInfoText
    .attr('fill', utils.TEXT_COLOR)
    .attr('x', sx(0))
    .attr('y', (d,i)=>sy(i));
  }


  get width(){
    return this.canvas.node().clientWidth;
  }

  get height(){
    return this.canvas.node().clientHeight;
  }


  // def getWidthHeight
  getWidthHeight(){
    // let width = this.svg.node().getBoundingClientRect().width;
    // let height = this.svg.node().getBoundingClientRect().height;
    let width = this.canvas.node().clientWidth;
    let height = this.canvas.node().clientHeight;

    return [width, height];
  }


  initResetZoomButton(){
    if(this.styles.defaultUI.indexOf('resetZoom') < 0){
      return;
    }

    let width = this.svg.node().getBoundingClientRect().width;
    let height = this.svg.node().getBoundingClientRect().height;
    let radius = this.styles.resetRadius/800*height;
    let margin = this.styles.marginRight - radius;

    //translate
    let tx = width - margin - radius*2;
    let ty = height - margin - radius*2;

    this.gResetZoom = this.svg.selectAll('#resetZoom')
    .data([0,])
    .enter()
    .append('g')
    .attr('id', 'resetZoom')
    .attr('opacity', this.styles.opacity['resetZoom'])
    .attr('transform', `translate(${tx}, ${ty})`)
    .style('cursor', 'pointer')
    .on('click', ()=>{
      this.resetZoom();
      d3.event.stopPropagation(); // TODO fix it: //prevent zoom event
      if(this.anotherView !== undefined){
        this.anotherView.resetZoom();
      }
    })
    .on('dbclick', ()=>{
      //TODO: prevent zoom event (doesnt work)
      // d3.event.stopPropagation();
    });
    this.gResetZoom = this.svg.selectAll('#resetZoom');
    
    let button = this.gResetZoom.selectAll('circle')
    .data([0])
    .enter()
    .append('circle')
    .attr('cx', radius)//relative to gResetZoom
    .attr('cy', radius)
    .attr('r', radius)
    .attr('fill', 'orange')
    
    let text = this.gResetZoom.selectAll('text')
    .data([0])
    .enter()
    .append('text')
    .attr('x', radius)
    .attr('y', radius)
    .attr('fill', 'white')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .style('user-select', 'auto') 
    .html('&#x21ba;');
  }


  initControlPanel(){
    this.initResetZoomButton();
  }

  initLayerControls(schema, layerIndex){
    let layerPosition = this.styles.layerPosition || 'right';
    
    let [width, height] = this.getWidthHeight();
    let data = schema.layers;

    let r = 0.006 * height;
    let w = 120;
    let h = Math.min( height * (550/800), r*(2+1.5)*data.length );
    let hi = h / data.length;
    let opacity = 0.3;
    
    let sx;
    if(layerPosition === 'right'){
      sx = d3.scaleLinear()
      .domain([0,1])
      .range([width-w-this.styles.marginRight, width-this.styles.marginRight]); //align with zoom reset button
    }else{
      let marginLeft = this.styles.marginRight/2;
      sx = d3.scaleLinear()
      .domain([0,1])
      .range([marginLeft, marginLeft+w]);
    }
    let sy = d3.scaleLinear()
    .domain([0,data.length-1])
    .range([height*(415/800)-h/2, height*(415/800)+h/2]);
    
    this.svg.selectAll('.layerControl')
    .data(data)
    .exit()
    .remove();
    this.layerControls = this.svg.selectAll('.layerControl')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'layerControl');
    this.layerControls = this.svg.selectAll('.layerControl')
    .attr('transform', (d,i)=>`translate(${sx(0)},${sy(i)})`);

    this.layerBoxes = this.layerControls
    .selectAll('.layerBox')
    .data(d=>[d])
    .enter()
    .append('rect')
    .attr('class', 'layerBox');
    this.layerBoxes = this.svg.selectAll('.layerBox')
    .attr('x', layerPosition=='right' ? w - 2*r : -2*r )
    .attr('y', 0)
    .attr('width', 4*r)
    .attr('height', hi)
    .attr('fill', 'white')
    .attr('fill-opacity', 0.001)
    .attr('stroke', 'white')
    .attr('stroke-width', 1.0)
    .attr('stroke-opacity', 0.001);

    this.layerMarks = this.layerControls
    .selectAll('.layerMark')
    .data(d=>[d])
    .enter()
    .append('circle')
    .attr('class', 'layerMark');
    this.layerMarks = this.svg.selectAll('.layerMark')
    .attr('cx', layerPosition=='right' ? w : 0 )
    .attr('cy', hi/2)
    .attr('r', r)
    // .attr('fill', '#777')
    .attr('fill', utils.TEXT_COLOR)
    .attr('opacity', (d,i)=>i==layerIndex?1.0:opacity);


    this.layerTexts = this.layerControls
    .selectAll('.layerText')
    .data(d=>[d])
    .enter()
    .append('text')
    .attr('class', 'layerText');

    this.layerTexts = this.svg.selectAll('.layerText')
    .attr('x', layerPosition=='right' ? w - 3*r : 3*r)
    .attr('y', hi/2)
    .attr('text-anchor', layerPosition=='right' ? 'end':'start')
    .attr('alignment-baseline', 'middle')
    .attr('fill', utils.TEXT_COLOR)
    .attr('opacity', 0.9)
    .attr('display', 'none')
    .attr('pointer-events', 'none')
    .text(d=>d.id);

    this.layerControls
    .on('mouseover', (_,i)=>{
      this.layerMarks
      .attr('opacity', (_,j)=>i==j ? 1.0 : opacity);
      this.layerTexts
      .attr('display', (_,j)=>i==j ? '' : 'none');
    })
    .on('mouseout', (newLayerIndex)=>{
      if(!Number.isInteger(newLayerIndex)){
        newLayerIndex = this.layerIndex;
      }
      this.layerMarks
      .attr('opacity', (_,j)=>j==newLayerIndex ? 1.0 : opacity);
      this.layerTexts
      .attr('display', (_,j)=>'none');
      // .attr('display', (_,j)=>j==this.layerIndex ? '' : 'none');
    })
    .on('click', (_,i)=>{
      this.setLayer(i);
    });









  }


  // initColorScale(labels){
  //   this.sc = d3.scaleOrdinal(
  //     utils.baseColors.map((d)=>[d[0]/255, d[1]/255, d[2]/255])
  //   )
  //   .domain(labels);

  //   // this.sc = d3.scaleQuantize()
  //   // .domain([0,199])
  //   // .range(utils.baseColors.map((d)=>[d[0]/255, d[1]/255, d[2]/255]));
  // }

  initAttributeOption(names){
    let id = `attributeSelect-${this.viewId}`;

    console.log(id, names);

    this.controlOverlay
    .selectAll('#'+id)
    .data([0])
    .enter()
    .append('select')
    .attr('id', id)
    .style('left', '20px')
    .style('top', '15px')
    .style('position', 'absolute');

    let attributeSelect = this.controlOverlay
    .select('#'+id);

    let options = attributeSelect
    .selectAll('option')
    .data(names)
    .enter()
    .append('option')
    .attr('value', d=>d)
    .text(d=>d);

    let that = this;
    attributeSelect.on('change', function(){
      let value = d3.select(this).property('value');
      
      that.currentOption = value;
      that.setAttribute(value);
      if(that.anotherView !== undefined){
        that.anotherView.currentOption = value;
        that.anotherView.setAttribute(value);
      }
    });

  }

  initAttributes(attributeData){
    let options = Object.keys(this.options);//use keys in meta as options
    let attributes = Object.keys(attributeData[0]).filter(a=>{
      for(let op of options){
        if(a.match(new RegExp(op))){
          return true;
        }else{
          continue;
        }
      }
      return false;
    });

    let option2attributes = {};
    let attrib2option = {};
    options.forEach(p=>option2attributes[p] = []);
    attributes.forEach(attr=>{
      for(let op of options){
        if(attr.match(new RegExp(op))){
          option2attributes[op].push(attr);
          attrib2option[attr] = op;
          break;
        }else{
          continue;
        }
      }
    });

    options.push('movement');
    attributes.push('movement');
    option2attributes['movement'] = ['movement'];
    attrib2option['movement'] = ['movement'];
    if(this.anotherView !== undefined){
      options.push('difference');
      attributes.push('difference');
      option2attributes['difference'] = ['difference'];
      attrib2option['difference'] = ['difference'];
    }

    options.push('none');
    attributes.push('none');
    option2attributes['none'] = ['none'];
    attrib2option['none'] = ['none'];

    if(this.styles.defaultUI.indexOf('attribute')>=0){
      this.initAttributeOption(options);
    }

    this.attributes = {};
    for(let a of attributes){
      let o = attrib2option[a];
      this.attributes[a] = {};
      if(a === 'none'){
        this.options[o] = {
          'type': 'categorical',
        };
        this.attributes[a] = {
          sc: (d)=>([1,1,1, 0.4]),
          domain: [0],
          domain2index:  {0:0},
        };
        attributeData.forEach(d=>d[a]=0);

      }else if(a === 'movement' || a === 'difference'){
        let domain = [0,1];
        let sa = d3.scaleLinear(domain, [0.05, 0.8]);//alpha
        if (utils.mode === 'dark'){
          let sc0 = d3.scaleLinear(domain, [0, 1]);
          this.attributes[a].sc = (d)=>{
            let c = d3.interpolateViridis(sc0(d));
            let rgb = utils.hexToRgb(c);
            let rgb_01 = rgb.map((d)=>d/255);
            let alpha = sa(d);
            rgb_01.push(sa(d));
            return rgb_01;
          };
        }else{
          let sc0 = d3.scaleLinear(
            d3.range(5).map(i=>i/4*(domain[1]-domain[0])+domain[0]), 
            ['#ffffff','#bdd7e7','#6baed6','#3182bd','#08519c']
          );
          this.attributes[a].sc = (d)=>{
            let c = d3.color(sc0(d)).formatHex();
            let rgb = utils.hexToRgb(c);
            let rgb_01 = rgb.map((d)=>d/255);
            let alpha = sa(d);
            rgb_01.push(sa(d));
            return rgb_01;
          };
        }
        
        this.options[o] = {
          type: 'continuous',
          extent: domain,
        };
      }else if(this.options[o].type === 'categorical'){
        let domain;
        if(this.options[o].order === undefined){
          domain = Array.from(new Set(attributeData.map(d=>d[a])));
        }else{
          domain = this.options[o].order;
        }
        let range = utils.baseColors.map((d)=>[d[0]/255, d[1]/255, d[2]/255]);
        this.attributes[a].sc = d3.scaleOrdinal(domain, range);
        this.attributes[a].domain = domain;
        this.attributes[a].domain2index = {};
        domain.forEach((d,i)=>this.attributes[a].domain2index[d]=i);

      }else if(this.options[o].type === 'ordinal'){
        let domain = this.options[o].order;
        let range = domain
        .map((d,i)=>utils.hexToRgb(d3.interpolateViridis(1-(i)/domain.length)))
        .map((d)=>[d[0]/255, d[1]/255, d[2]/255]);
        this.attributes[a].sc = d3.scaleOrdinal(domain, range);
        this.attributes[a].domain = domain;
        this.attributes[a].domain2index = {};
        domain.forEach((d,i)=>this.attributes[a].domain2index[d]=i);

      }else if(this.options[o].type === 'continuous'){
        attributeData.forEach(d=>d[a]=+d[a]); //convert to numerical values
        let domain;
        if(this.options[o].extent !== undefined){
          domain = this.options[o].extent;
        }else{
          domain = d3.extent(attributeData, d=>d[a]);
        }
        let range = [0,1];
        let sc0 = d3.scaleLinear(domain, range);
        this.attributes[a].sc = (d)=>{
          let c = d3.interpolateViridis(sc0(d));
          let rgb = utils.hexToRgb(c);
          let rgb_01 = rgb.map((d)=>d/255);
          return rgb_01;
        };
        this.attributes[a].domain = domain;
      }
      
      // if(this.dataObj.colors === undefined){
      if(o === options[0]){
        this.currentOption = o;
        this.currentAttribute = a;
        this.setAttribute(option2attributes[o][0]);
      }
        
    }
  }


  setAttribute(name){

    //clear legend selection
    // this.updateSelectedLabels(new Set(d3.range(this.attributes[name].domain.length)));
    this.updateSelectedLabels(new Set());


    this.currentAttribute = name;
    if(
      this.options[name] && 
      (
        this.options[name].type === 'categorical'
        ||this.options[name].type === 'ordinal'
      )
    ){
      this.initLegend(name);
    }else{
      //TODO
    }

    if(name == 'movement' || name === 'difference'){
      if(this.dataObj.colors[name] === undefined){
        this.dataObj.colors[name] = {};
        this.dataObj[name] = {};
      }

      let k0, prev;
      if(name == 'movement'){
        k0 = [
          this.epochIndexPrev, 
          this.archIndexPrev, 
          this.layerIndexPrev
        ];
        prev = this.dataObj[k0[0]][k0[1]][k0[2]];
      }else if(name === 'difference'){
        k0 = [
          this.anotherView.epochIndex, 
          this.anotherView.archIndex, 
          this.anotherView.layerIndex
        ];
        prev = this.anotherView.dataObj[k0[0]][k0[1]][k0[2]];
      }

      let k1 = [this.epochIndex, this.archIndex, this.layerIndex];
      let key;
      if(name == 'movement'){
        key = k0 < k1 ? `${k0},${k1}` : `${k1},${k0}`;
      }else{
        key = `${k0},${k1}`;
      }
      console.log(key);

      let colors, dist;
      if(this.dataObj.colors[name][key] === undefined){
        let next = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
        dist = utils.procrustes_dist(next, prev);
        colors = dist.map(d=>this.attributes[name].sc(d));
        this.dataObj.colors[name][key] = colors;
        this.dataObj[name][key] = dist;
      }else{
        colors = this.dataObj.colors[name][key];
        dist = this.dataObj[name][key];
      }
      this.updateColor(colors);
    }else{
      console.log('Color by:', name);
      if(this.dataObj.colors === undefined){
        this.dataObj.colors = {};
      }
      if(this.dataObj.colors[name] === undefined){
        this.dataObj.colors[name] = this.dataObj.attributes.map(d=>this.attributes[name].sc(d[name]));
      }
      this.updateColor(this.dataObj.colors[name]);
      
      let attribute;
      if(this.attributes[name].type === 'continuous'){
        attribute = this.dataObj.attributes.map(d=>d[name]);
      }else{
        attribute = this.dataObj.attributes.map(d=>d[name]).map(d=>this.attributes[name].domain.indexOf(d));
      }
      this.updateLabel(attribute);//update 'label' data in webgl
    }
    
    
  }

  // def initLegend
  // initLegend(labels, texts, sc){
  initLegend(name){

    let data = this.attributes[name].domain.map((d,i)=>{
      return {
        index: i,
        label: d,
        text: d,
      }
    });
    let sc = this.attributes[name].sc;

    let [width,height] = this.getWidthHeight();

    let markerRadius = (4/800) * height;
    this.markerRadius = markerRadius;

    let marginLeft = 20;
    let marginRight = this.styles.marginRight + 30;
    let marginTop = 10;
    let marginBottom = this.styles.marginRight - this.styles.resetRadius*800/height;

    // let nrow = 5;
    // let ncol =  Math.ceil(data.length / nrow);

    let ncol = 10;
    let nrow = Math.ceil(data.length / ncol);

    let legendWidth = Math.min(
      width - marginLeft - marginRight, 
      // ncol * (2*markerRadius + 1 * d3.max(texts,t=>t.length)) //with text
      ncol * 3 * markerRadius //without text
    );
    let legendHeight = Math.min(
      // height * (140/800) - marginTop - marginBottom, 
      nrow * 3 * markerRadius
    );

    // lower right
    // let left = width - marginRight - legendWidth;
    // let top = height - marginBottom - legendHeight;

    //// upper left
    let left = marginLeft;
    let top = marginTop + 50;

    this.legendBoundingBox = {
      top,
      left,
      width: legendWidth,
      height: legendHeight,
      marginLeft: marginLeft,
      marginRight: marginRight,
      marginTop: marginTop,
      marginBottom: marginBottom,
    };


    this.legendSx = d3.scaleLinear()
    .domain([0, ncol])
    .range([0, legendWidth]);
    this.legendSy = d3.scaleLinear()
    .domain([0, nrow])
    .range([0, legendHeight]);

    if(this.gLegend === undefined){
      let id = `legend-container-${this.viewId}`;
      this.gLegend = this.svg.selectAll('#'+id)
      .data([0])
      .enter()
      .append('g')
      .attr('id', id)
      .attr('opacity', this.styles.opacity['legend'])
      .attr('display', this.styles.defaultUI.indexOf('legend')>=0? '':'none');
    }
    this.gLegend
    .attr('transform', `translate(${left},${top})`)
    .html('');

    this.gLegend.selectAll('.legend-item')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'legend-item');


    this.legendItems = this.gLegend.selectAll('.legend-item')
    .attr('transform', d=>{
      let col = Math.floor(d.index / nrow);
      let row = d.index % nrow;
      let x = this.legendSx(col);
      let y = this.legendSy(row)
      return `translate(${x}, ${y})`;
    });

    let updateLegendOpactity = (selected)=>{
      this.legendItems.attr('opacity', d=>{
        return selected.has(d.index) ? 1.0: 0.3;
      });
      this.legendTexts.attr('opacity', d=>{
        return selected.has(d.index) ? 1.0: 0.0;
      });
    }
    
    let legendItemWidth = legendWidth / ncol;
    let legendItemHeight = legendHeight / nrow;

    this.legendReactiveBounds = this.legendItems
    .selectAll('rect')
    .data((d)=>[d])
    .enter()
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', legendItemWidth)
    .attr('height', legendItemHeight)
    .attr('fill', 'black')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.001);

    this.legendMarkers = this.legendItems
    .selectAll('circle')
    .data((d)=>[d])
    .enter()
    .append('circle')
    .attr('cx', d=>legendItemWidth/2)
    .attr('cy', d=>legendItemHeight/2)
    .attr('stroke-width', 0)
    .attr('stroke', '#999')
    .attr('fill', d=>{
      let rgb = sc(d.label);
      return d3.rgb(rgb[0]*255, rgb[1]*255, rgb[2]*255);
    })
    .attr('r', markerRadius)
    .style('pointer-events', 'none');



    this.legendTexts = this.legendItems
    .selectAll('text')
    .data((d)=>[d])
    .enter()
    .append('text')
    .attr('x', d=>legendItemWidth + markerRadius)
    .attr('y', d=>legendItemHeight/2)
    .attr('font-size', '0.8rem')
    .attr('fill', d=>{
      let rgb = sc(d.label);
      return d3.rgb(rgb[0]*255, rgb[1]*255, rgb[2]*255).brighter(3);
    })
    .attr('text-anchor', 'begin')
    .attr('alignment-baseline', 'middle')
    .attr('opacity', 0.0)
    .style('pointer-events', 'none')
    .style('filter', 'url(#whiteOutlineEffect)')
    .text(d=>d.text);


    this.legendReactiveBounds
    // this.legendItems
    // this.legendMarkers
    .on('mouseover', (d,i, shouldSetAnother)=>{
      let label = d.index;
      let selectedLabelsTmp = new Set(this.selectedLabels);
      selectedLabelsTmp.add(label);
      this.updateSelectedLabels(selectedLabelsTmp);
      updateLegendOpactity(selectedLabelsTmp);
      this.render();
      shouldSetAnother = shouldSetAnother !== undefined ? shouldSetAnother : true;
      if(this.anotherView !== undefined && shouldSetAnother){
        this.anotherView.legendReactiveBounds.on('mouseover')(d, i, false);
      }
    })
    .on('mouseout', (d,i, shouldSetAnother)=>{
      let label = d.index;
      let selectedLabelsTmp = new Set(this.selectedLabels);
      if(selectedLabelsTmp.size == 0){
        selectedLabelsTmp = new Set(data.map(d=>d.index));
      }
      this.updateSelectedLabels(selectedLabelsTmp);
      updateLegendOpactity(selectedLabelsTmp);
      this.legendTexts.attr('opacity', 0.0);
      this.render();
      shouldSetAnother = shouldSetAnother !== undefined ? shouldSetAnother : true;
      if(this.anotherView !== undefined && shouldSetAnother){
        this.anotherView.legendReactiveBounds.on('mouseout')(d, i, false);
      }
    })
    .on('click', (d,i)=>{
      let label = d.index;
      if(this.selectedLabels.has(label)){
        this.selectedLabels.delete(label);
      }else{
        this.selectedLabels.add(label);
      }
      let selectedLabelsTmp = new Set(this.selectedLabels);
      if(selectedLabelsTmp.size == this.attributes[this.currentAttribute].domain.length){
        this.selectedLabels = new Set();
      }
      // if(selectedLabelsTmp.size == 0){
      //   selectedLabelsTmp = new Set(labels);
      // }
      this.updateSelectedLabels(selectedLabelsTmp);
      updateLegendOpactity(selectedLabelsTmp);
      this.render();
      if(this.anotherView !== undefined && this.isMouseOn){
        this.anotherView.legendReactiveBounds.on('click')(d,i);
      }
    });

  }


  resetZoom(){
    let [width, height] = this.getWidthHeight();
    // let zoomCenter = this.styles.zoomCenter || [width/2, height/2];
    let zoomScale = this.styles.zoomScale || 1.0;
    let focus = this.styles.focus || [0.5, 0.5];
    // if(this.transform === this.focusTransform){
    //   this
    //   .focusDataAt(Array(this.ndim).fill(0), focus, zoomScale*1.2, 750, 0)
    //   .focusDataAt(Array(this.ndim).fill(0), focus, zoomScale, 750, 750);
    // }else{
      this.focusDataAt(Array(this.ndim).fill(0), focus, zoomScale);
    // }
  }

  setUI(enabled_components, duration=1000, delay=0){
    enabled_components = new Set(enabled_components);
    if(this.UI_components === undefined){
      this.UI_components = {
        'handle': [this.handles, this.handleLines, this.handleTexts],
        'legend': [this.gLegend],
        'resetZoom': [this.gResetZoom],
        'fps': [this.fpsText],
        'zoom': [this.zoom],
        'layer': [this.layerControls],
        'help': [this.help],
        'epoch': [this.epochSlider, this.epochLabel],
      };
    }
    Object.keys(this.UI_components)
    .forEach(k=>{
      if(k === 'zoom'){
        //disable & enable zoom
        if(enabled_components.has(k)){
          this.svg.call(this.zoom);
        }else{
          this.svg.on('.zoom', null);
        }
      }else{
        //change opacity and display
        let components = this.UI_components[k];
        components.forEach((ci, i)=>{
          if(ci._groups[0].length == 0){ //if the d3 selection empty
            return;
          }
          let opacity;
          let display = '';
          if(enabled_components.has(k)){
            if(k === 'handle'){ //special care to handles
              if(i == 0){//handle circles 
                opacity = 1.0;
              }else if(i==1){//handleLines
                opacity = this.styles.opacity['handleLine'];
              }else{//handleTexts
                opacity = this.styles.opacity['handleText'];
              }
            }else{
              opacity = this.styles.opacity[k];
            }
          }else{
            opacity =  0.0;
            display = 'none';
          }
          ci.transition()
          .duration(duration)
          .delay(delay)
          .style('opacity', opacity)
          .style('display', display);
        });
      }
    });
  }

  showUI(components, duration=1000, delay=0){
    if(!Array.isArray(components)){//in case of a singleton, make it an array
      components = [components];
    }
    components.forEach(c=>{
      if(c !== undefined){
        c.transition()
        .duration(duration)
        .delay(delay)
        .attr('opacity', c.opacity0 || 1.0);
      }
    });
  }

  hideUI(components, duration=1000, delay=0){
    if(!Array.isArray(components)){
      components = [components];
    }
    components.forEach(c=>{
      if(c._groups[0].length > 0){
        c.opacity0 = c.attr('opacity') || 1.0; //store the original opacity;
        c.transition()
        .duration(duration)
        .delay(delay)
        .attr('opacity', 0.0);
      }
    });
  }


  // def annotate
  annotate(annotationData){
    let data = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
    annotationData.forEach((d,i)=>{
      // calculate centroid data
      if(data !== undefined && data.length > 0){
        let selection_data = [];
        for (let s=0; s<d['selection'].length; s++){
          if(this.sampleIndexSet.has(d['selection'][s])){
            let i = this.s2i[d['selection'][s]];
            selection_data.push(data[i]);
          }
        }
        if(selection_data.length > 0){
          d['centroid'] = math.mean(selection_data, 0);
        }
        
      }else{
        //pass, use the default centroid
        // d['centroid'] = d['centroid'];
      }
      
      // important presentational data
      d['radius'] = d['radius'] !== undefined ? d['radius'] : 10;
      d['text'] = d['text'] !== undefined ? d['text'] : '';
      d['textOffset'] = d['textOffset'] !== undefined ? d['textOffset'] : [0,-1.1];
      
      //boolean settings
      d['isEditable'] = false;
      d['handleLine'] = d['handleLine'] !== undefined ? d['handleLine'] : false;
      d['highlight'] = d['highlight'] !== undefined ? d['highlight'] : true;

      //other default styles
      d['stroke-dasharray'] = d['stroke-dasharray'] !== undefined ? d['stroke-dasharray'] : '6 6';
      d['fill-opacity'] = d['fill-opacity'] !== undefined ? d['fill-opacity'] : 0.09;
      d['stroke-width'] =  d['stroke-width'] !== undefined ? d['stroke-width'] : 2;
      d['stroke'] =  d['stroke'] !== undefined ? d['stroke'] : 'white';
      d['text-anchor'] = d['text-anchor'] !== undefined ? d['text-anchor'] : 'middle';
    });

    this.annotationData = annotationData;
    this.annotationHandleData = this.annotationData.concat(this.handleData);
    this.initHandle(this.annotationHandleData);
    this.render();
  }


  focusDataAt(data, at=undefined, scale=1.0,
    duration=750, delay=0){
    // Pan&Zoom so that a particular data point.
    // 'data" is located at "at"
    let [width, height] = this.getWidthHeight();
    if(at === undefined){
      at = [0.5, 0.5]; //center
    }

    window.setTimeout(()=>{
      //cannt use d3.transition().delay(xxx) here
      //because we compute the projection only when timeout
      data = this.project(data, true)[0]; 

      let targetTransform = d3.zoomIdentity
      //additional transform:
      .translate(at[0]*width, at[1]*height)
      .scale(scale / this.transform.k)
      .translate(-data[0], -data[1])
      //current transform:
      .translate(this.transform.x, this.transform.y)
      .scale(this.transform.k);

      this.svg
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call( this.zoom.transform, targetTransform);

      this.focusTransform = targetTransform;

    }, delay);
    return this;
  }


  // setZoom(scale, scaleCenter=undefined, 
  //   translate=[0,0], 
  //   delay=0, duration=900){
  //   if(center === undefined){
  //     let [width, height] = this.getWidthHeight();
  //     scaleCenter = [width/2+translate[0], height/2+translate[1]];
  //   }
  //   this.svg
  //   .transition()
  //   .duration(duration)
  //   .delay(delay)
  //   .ease(d3.easeCubicInOut)
  //   .call( this.zoom.transform, 
  //     d3.zoomIdentity
  //     .translate(translate, translate)
  //     .translate(scaleCenter[0], scaleCenter[1])
  //     .scale(scale)
  //     .translate(-scaleCenter[0], -scaleCenter[1])
  //   );
  //   return this;
  // }

  // //def setZoom
  // setZoom(translate=[0,0], scale=1.0, delay=0){
  //   let [width, height] = this.getWidthHeight();
  //   let center = [width/2+translate[0], height/2+translate[1]];
  //   this.svg
  //     .transition()
  //     .duration(900)
  //     .delay(delay)
  //     .ease(d3.easeCubicInOut)
  //     .call( this.zoom.transform, 
  //       d3.zoomIdentity
  //       .translate(center[0], center[1])
  //       .scale(scale)
  //       .translate(-center[0], -center[1])
  //     );
  //   return this;
  // }

  //// relative offset (0~1)
  // setZoom(offset=[0,0], scale=1.0, delay=0){
  //   let [width, height] = this.getWidthHeight();
  //   let center = [width/2, height/2];
  //   let r = Math.min(width, height) * scale;
  //   this.svg
  //     .transition()
  //     .duration(900)
  //     .delay(delay)
  //     .ease(d3.easeCubicInOut)
  //     .call( this.zoom.transform, 
  //       d3.zoomIdentity
  //       .translate(offset[0]*r, offset[1]*r)
  //       .translate(center[0], center[1])
  //       .scale(scale)
  //       .translate(-center[0], -center[1])
  //     );
  //   return this;
  // }

  onKeyDown(key){
    console.log(key);

    if(key === ' ' || key === 'p'){
      if(this.alignmentMode === undefined || this.alignmentMode == 'leader'){
        this.isGrandTourPlaying = !this.isGrandTourPlaying;
        if(this.isGrandTourPlaying){
          console.log('gt play');
          this.play();
          if(this.anotherView !== undefined){
            this.anotherView.play();
          }
        }else{
          console.log('gt pause');
          this.pause();
          if(this.anotherView !== undefined){
            this.anotherView.pause();
          }
        }
      }
    }else if(key === 'i'){
      this.pointMode = this.pointMode === 'point' ? 'image':'point';
      this.update({pointMode: this.pointMode});
    // }else if(key === 'p'){ // pan zoom
      // this.gBrush.attr('display', 'none');
    // }else if(event.key === 'b'){ // brush
    //   this.gBrush.attr('display', '');
    }else if(key === 'f'){ //[F]ilter
      if(this.isMouseOn){
        this.gBrush.attr('display', '');
        this.brushMode = 'filter';
      }
    }else if(key === 'c'){ //[C]lear brush
      this.clearBrush();
    }else if(key === 'd'){ //[D]irect manipulation
      if(this.isMouseOn){
        this.addHandle();
      }
    }else if(key === 'x'){ //Delete handle
      // this.clearHandle();
      this.removeLastHandle();

    }else if(key === 'h' || key === 'l'){ //prev Epoch
      let epochIndex;
      if(key === 'h'){
        epochIndex = this.epochIndex - 1;
      }else{
        epochIndex = this.epochIndex + 1;
      }
      if(epochIndex >= this.epochs.length){
        epochIndex = 0;
      }else if(epochIndex < 0){
        epochIndex = this.epochs.length-1;
      }
      console.log('epoch', epochIndex);
      this.setEpoch(epochIndex);
    }else if(key === 'j' || key === 'k'){
      let layerIndex = this.layerIndex;
      if(key === 'j'){
        layerIndex += 1;
      }else{
        layerIndex -= 1;
      }

      if(layerIndex < 0){
        layerIndex = this.layers.length-1;
      }else if(layerIndex >= this.layers.length){
        layerIndex = 0;
      }


      this.layerControls.on('mouseover')(null, layerIndex);
      // this.layerControls.on('mouseout')(layerIndex);
      this.setLayer(layerIndex);
    }

    if( this.animId !== undefined){
      this.render();
    }
  }


  enableKeyboardShortcut(){
    let isFocus = true;
    // window.addEventListener('mousemove', (event)=>{
    //   let [x,y] = [event.clientX, event.clientY];
    //   let bbox = this.canvas.node().getBoundingClientRect();
    //   isFocus = bbox.left <= x && x <= bbox.right
    //   && bbox.top <= y && y <= bbox.bottom; 
    // });

    window.addEventListener('keydown', (event)=>{
      if(isFocus){
        let key = event.key.toLowerCase();
        this.onKeyDown(key);
      }
    });
  }

  addHandle(){
    this.gBrush.attr('display', '');
    this.brushMode = 'direct-manipulation';
  }


  nearestNeighbor(p, k=1){
    function distance(a, b){
      return math.norm(numeric.sub(a,b));
    }

    let nearest = [[-1, Infinity],];
    if(this.dataObj && this.dataObj.pos !== undefined){
      for(let i=0; i<this.dataObj.pos.length; i++){
        let d = distance(p, this.dataObj.pos[i].slice(0,2));
        if(d < nearest[nearest.length-1][1]){
          nearest.push([i,d]);
          nearest = nearest.sort((a,b)=>a[1]-b[1]);
          nearest = nearest.slice(0,k);
        }
      }
    }
    if(k==1){
      return nearest.map(d=>d[0])[0];
    }else{
      return nearest.map(d=>d[0]);
    }
  }


  initGL(){
    this.gl = initGL(this.canvas.attr('id'), [vShaderScript,fShaderScript]);
    let gl = this.gl;

    gl.useProgram(this.gl.program);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE, gl.ONE_MINUS_SRC_ALPHA
    );

    clear(gl, [...this.bg_color, 1.0]);
    // gl.clearColor(...utils.CLEAR_COLOR, 1.0);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    update_uniform(gl, 'point_size', this.pointSize*Math.sqrt(this.zoomFactor)*devicePixelRatio);
    update_uniform(gl, 'min_size', this.pointSize/2*Math.sqrt(this.zoomFactor)*devicePixelRatio);
    update_uniform(gl, 'zoom_factor', this.zoomFactor);

    update_data(gl, 'a_mode', Array(this.sampleSize).fill(0.0));
    update_data(gl, 'a_index', this.sampleIndices);

    this.updatePreprocess(this.preprocess);
    this.updateProcrustes(this.procrustes);
    this.updateProcrustesPrev(this.procrustesPrev);
    this.updatePostprocess(this.postprocess);
    this.updatePointMode(this.pointMode);
    this.initTexture(this.imageUrls);
    // this.initTexture([]); // feed a blank texture
    
  }

  initTexture(urls=['data/cifar10-10000.png',]){

    let gl = this.gl;
    if(urls.length > 0){
      for(let i=0; i<urls.length; i++){
        let texture = utils.loadTexture(gl, urls[i], `imageTexture_${i}`, i);
      }
    }else{
      for(let i=0; i<15; i++){
        let texture = utils.loadTexture(gl, 'data/images/blank.png', `imageTexture_${i}`, i);
      }
    }
    
  }


  onUmapClick(archIndex){
    this.setArch(archIndex);
  }

  onLayerClick(layerIndex){
    let duration = undefined;
    this.setEpochArchLayer(this.epochIndex, this.archIndex, layerIndex, duration, ()=>{
      this.handleData = this.handleData.map(d=>{
        if(d.selection.length > 0){
          let data = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
          d.centroid = math.mean(d.selection.map(i=>data[i]), 0);
          let dataPrev = this.dataObj[this.epochIndex][this.archIndex][this.layerIndexPrev];
          d.centroidPrev = math.mean(d.selection.map(i=>dataPrev[i]), 0);
        }
        return d;
      });

      // if(this.anotherView !== undefined){
      //   this.anotherView.alignWith(this);
      // }
    });
    // this.animateLayer(layerIndex);
  }


  // def load
  load(epochIndex, archIndex, layerIndex, duration=0.001, display=true, callback=undefined){
    let key = `${epochIndex},${archIndex}`;
    let dir = this.epoch_arch_to_dir[key];
    
    if(this.dataObj.schemas === undefined){
      this.dataObj.schemas = {};
    }

    if(this.dataObj.schemas[key] !== undefined){
      let schema = this.dataObj.schemas[key];
      if(schema === 'pending'){
        return;
      }else{
        this.loadLayerFromSchema(schema, `data/${dir}`, epochIndex, archIndex, layerIndex, duration, display, callback);
      }
    }else{
      this.dataObj.schemas[key] = 'pending';
      let schemaUrl = `data/${dir}/schema.json`;
      d3.json(schemaUrl).then((schema)=>{
        
        this.dataObj.schemas[key] = schema;
        this.layers = schema.layers;
        this.loadLayerFromSchema(schema, `data/${dir}`, epochIndex, archIndex, layerIndex, duration, display, callback);

        this.initLayerControls(schema, layerIndex);

      });
    }
    
  }


  setEpoch(epochIndex, duration, callback){
    this.setEpochArchLayer(epochIndex, this.archIndex, this.layerIndex, duration, callback);
  }

  setArch(archIndex, duration, callback){
    this.setEpochArchLayer(this.epochIndex, archIndex, this.layerIndex, duration, callback);
  }


  setLayer(layerIndex, duration, callback){
    
    // if(this.currentOption === 'layerDist-*'){
    //   // this.setAttribute(`layerDist-${layerIndex}`);
    //   let pos0 = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
    //   let pos1 = this.dataObj[this.epochIndex][this.archIndex][layerIndex];
    //   let dist = 
    // }
    this.setEpochArchLayer(this.epochIndex, this.archIndex, layerIndex, duration, callback);
  }

  setEpochArch(epochIndex, archIndex, duration, callback){
    this.setEpochArchLayer(epochIndex, archIndex, this.layerIndex, duration, callback);
  }

  setOrientation(orientation, duration=350, delay=0){
    let o = orientation;
    let inter_gt = utils.interpolate_m(this.gt.matrix, o.grandtour);
    let inter_pre = utils.interpolate_m(this.preprocess, o.preprocess);
    let inter_pro = utils.interpolate_m(this.procrustes, o.procrustes);
    let inter_post = utils.interpolate_m(this.postprocess, o.postprocess);
    let t = 0; //internal clock for this animation
    let t0 = undefined;
    let animId = undefined;
    // temporarily pause the grand tour:
    // fix me: this pauses the grand tour and does not resume to the original speed
    // this.gt_STEPSIZE1 = this.gt.STEPSIZE;
    // this.gt.STEPSIZE = 0; 
    let tick = (t1)=>{
      let dt = (t0 !== undefined) ? t1-t0 : 0;
      t += dt;
      t0 = t1;
      let s = (t-delay) / duration; //internal progress
      if(s < 0){
        animId = window.requestAnimationFrame(tick);
        return;
      }else if(s >= 0 && s < 1.0){
        s = s*s*(3-2*s);//non-linear (cubic) interpolation
        this.gt.matrix = inter_gt(s);
        this.preprocess = inter_pre(s);
        this.procrustes = inter_pro(s);
        this.postprocess = inter_post(s);
        animId = window.requestAnimationFrame(tick);
      }else{
        this.gt.matrix = o.grandtour;
        this.preprocess = o.preprocess;
        this.procrustes = o.procrustes;
        this.postprocess = o.postprocess;
        this.gt.thetas = o.grandtour_thetas;
        this.gt.t = o.grandtour_t;
        // this.gt.STEPSIZE = this.gt_STEPSIZE1;//resume to the original grand tour speed:
        window.cancelAnimationFrame(animId);
      }
      this.update({
        preprocess:this.preprocess,
        procrustes:this.procrustes,
        grandtour:this.gt.matrix,
        postprocess:this.postprocess,
      });
    };
    animId = window.requestAnimationFrame(tick);
  }


  setFloatEpochArchLayer(
  epochIndexFloor, epochIndexCeil,
  archIndexFloor, archIndexCeil,
  layerIndexFloor, layerIndexCeil,
  progress,
  ){

    let floatEpoch = epochIndexFloor + progress * (epochIndexCeil - epochIndexFloor);
    let floatLayer = layerIndexFloor + progress * (layerIndexCeil - layerIndexFloor);

    //now this only works on diff epochs
    //TODO fix me for generic case
    if(this.epochIndexFloor == epochIndexFloor
    && this.epochIndexCeil == epochIndexCeil
    && this.archIndexFloor == archIndexFloor
    && this.archIndexCeil == archIndexCeil
    && this.layerIndexFloor == layerIndexFloor
    && this.layerIndexCeil == layerIndexCeil
    ){// i.e. if epoch is the same
      this.progress = progress;
      this.update({
        progress: this.progress,
      });
    }else{
      if(this.dataObj[epochIndexFloor]!==undefined
      && this.dataObj[epochIndexFloor][archIndexFloor] !== undefined
      && this.dataObj[epochIndexFloor][archIndexFloor][layerIndexFloor] !== undefined
      && this.dataObj[epochIndexFloor][archIndexFloor][layerIndexFloor].length > 0
      && this.dataObj[epochIndexCeil]!==undefined 
      && this.dataObj[epochIndexCeil][archIndexCeil] !== undefined
      && this.dataObj[epochIndexCeil][archIndexCeil][layerIndexCeil] !== undefined
      && this.dataObj[epochIndexCeil][archIndexCeil][layerIndexCeil].length > 0
      ){//if everything is downloaded

        if(this.epochIndexFloor !== undefined){
          //pre-alignment with current display
          let bed = this.dataObj[this.epochIndexFloor][this.archIndexFloor][this.layerIndexFloor];
          let traveler = this.dataObj[epochIndexFloor][archIndexFloor][layerIndexFloor];
          let Q = utils.orthogonal_procrustes(traveler, bed);
          this.procrustesPrev = 
          numeric.dot(
            numeric.dot(
              numeric.dot(
                numeric.inv(this.preprocess),
                Q
              ),
              this.preprocess
            ),
            this.procrustesPrev
          );
          this.update({
            procrustesPrev: this.procrustesPrev,
          });
        }
        //alignment between floor and ceil
        let floor = this.dataObj[epochIndexFloor][archIndexFloor][layerIndexFloor];
        let ceil = this.dataObj[epochIndexCeil][archIndexCeil][layerIndexCeil];
        let traveler = ceil;
        let bed = floor;
        let Q = utils.orthogonal_procrustes(traveler, bed);
        this.procrustes = 
        numeric.dot(
          numeric.dot(
            numeric.dot(
              numeric.inv(this.preprocess),
              Q
            ),
            this.preprocess
          ),
          this.procrustesPrev
        );
        this.update({
          data: traveler,
          dataPrev: bed,
          data_buffer: `data_${epochIndexCeil}_${archIndexCeil}_${layerIndexCeil}`,
          dataPrev_buffer: `data_${epochIndexFloor}_${archIndexFloor}_${layerIndexFloor}`,
          progress: progress,
          procrustes: this.procrustes,
        });
      }else{
        let callback = ()=>{
          this.setFloatEpochArchLayer(
            epochIndexFloor, epochIndexCeil,
            archIndexFloor, archIndexCeil,
            layerIndexFloor, layerIndexCeil,
            progress
          );
        };
        if(this.dataObj[epochIndexFloor]===undefined 
        || this.dataObj[epochIndexFloor][archIndexFloor] === undefined
        || this.dataObj[epochIndexFloor][archIndexFloor][layerIndexFloor] === undefined
        ){
          this.load(epochIndexFloor, archIndexFloor, layerIndexFloor, 0.001, false, callback);
        }
        if(this.dataObj[epochIndexCeil]===undefined 
        || this.dataObj[epochIndexCeil][archIndexCeil] === undefined
        || this.dataObj[epochIndexCeil][archIndexCeil][layerIndexCeil] === undefined
        ){
          this.load(epochIndexCeil, archIndexCeil, layerIndexCeil, 0.001, false, callback);
        }
        return;
      }
    }
    this.epochIndexFloor = epochIndexFloor;
    this.epochIndexCeil = epochIndexCeil;

    this.archIndexFloor = archIndexFloor;
    this.archIndexCeil = archIndexCeil;

    this.layerIndexFloor = layerIndexFloor;
    this.layerIndexCeil = layerIndexCeil;

    this.floatEpochPrev = floatEpoch;
    this.floatLayerPrev = floatLayer;


  }

  saveHandleCentroidPrev(){
    this.handleData.forEach(d=>{
      if(d.centroid !== undefined){
        d.centroidPrev = d.centroid;
      }
    });
    this.annotationData.forEach(d=>{
      if(d.centroid !== undefined){
        d.centroidPrev = d.centroid;
      }
    });
  }

  // def setEpochArchLayer
  setEpochArchLayer(epochIndex, archIndex, layerIndex, duration, callback0){
    
    //store previous centroids in handle data
    this.saveHandleCentroidPrev();

    let callback = ()=>{
      //update centroid data
      if(callback0 !== undefined){
        callback0();
      }
    };
    this.epochIndexPrev = this.epochIndex!==undefined ? this.epochIndex : epochIndex;
    this.epochIndex = epochIndex;
    this.archIndexPrev = this.archIndex!==undefined ? this.archIndex : archIndex;
    this.archIndex = archIndex;
    this.layerIndexPrev = this.layerIndex!==undefined ? this.layerIndex : layerIndex;
    this.layerIndex = layerIndex;

    if (duration === undefined){
      if(this.layerIndex !== this.layerIndexPrev){
        duration = this.layerTransitionTime;
      }else if(this.archIndex !== this.archIndexPrev){
        duration = this.archTransitionTime;
      }else if(this.epochIndex !== this.epochIndexPrev){
        duration = this.epochTransitionTime;
      }else{
        duration = 0.01;
      }
    }

    if(this.hasStarted === true
    && this.epochIndexPrev === epochIndex
    && this.archIndexPrev === archIndex
    && this.layerIndexPrev === layerIndex){
      callback();
      return;
    }else{
      if(this.dataObj[epochIndex] !== undefined 
      && this.dataObj[epochIndex][archIndex] !== undefined
      && this.dataObj[epochIndex][archIndex][layerIndex] !== undefined){
        let prev = this.dataObj[this.epochIndexPrev][this.archIndexPrev][this.layerIndexPrev];
        let next = this.dataObj[epochIndex][archIndex][layerIndex];
        let prev_buffer = `data_${this.epochIndexPrev}_${this.archIndexPrev}_${this.layerIndexPrev}`;
        let next_buffer = `data_${epochIndex}_${archIndex}_${layerIndex}`;
        this.calculateHandleCentroid(next);
        this.transition(prev, next, prev_buffer, next_buffer,  duration, callback);
      }else{
        this.load(epochIndex, archIndex, layerIndex, duration, true, callback);
      }
    }
  }

  // def transition
  transition(prev, next, prev_buffer, next_buffer, duration, callback){
    if(prev === undefined || next === undefined){
      window.setTimeout(()=>{
        transition(prev, next, prev_buffer, next_buffer, duration, callback);
      }, 50);
    }

    let bed = prev;
    let traveler = next;

    this.procrustesPrev = this.procrustes;
    let Q = utils.orthogonal_procrustes(traveler, bed);
    this.procrustes = 
    numeric.dot(
      numeric.dot(
        numeric.dot(
          numeric.inv(this.preprocess),
          Q
        ),
        this.preprocess
      ),
      this.procrustesPrev
    );
    this.progress = 0.0; // for this.animate()
    this.update({
      progress: this.progress,
      data: next,
      dataPrev: prev,
      data_buffer: next_buffer, 
      dataPrev_buffer: prev_buffer,
      procrustes: this.procrustes,
      procrustesPrev: this.procrustesPrev,
    });

    if(this.currentOption === 'movement'){
      this.setAttribute('movement');
    }else if(this.currentOption === 'difference'){
      this.setAttribute('difference');
      this.anotherView.setAttribute('difference');
    }

    let t0 = undefined;

    let tick = ()=>{
      this.transitionAnimId = requestAnimationFrame((now)=>{
        if(t0 === undefined){
          t0 = performance.now();
        }
        let dt = now - t0;
        let progress = dt / duration;

        if(progress < 0){
          tick();
        }else if(progress > 0 && progress < 1){
          progress = progress*progress*(3-2*progress);//non-linear (cubic) interpolation
          this.progress = progress;
          this.update({
            progress:this.progress
          });
          tick();
        }else{
          this.progress = 1.0;
          this.update({
            progress: this.progress,
          });
          cancelAnimationFrame(this.transitionAnimId);
          if(callback !== undefined){
            callback();
          }
        }
      });
    };
    tick();
  }

  calculateHandleCentroid(newData){
    this.handleData.forEach((h)=>{
      if(h.selection.length > 0){
        let points = h.selection.map(s=>newData[this.s2i[s]]);
        let centroid = math.mean(points, 0);
        h.centroid = centroid;
      }
    });
    this.annotationData.forEach((h)=>{
      let points = [];
      for(let j=0; j<h.selection.length; j++){
        let s = h.selection[j];
        if(this.sampleIndexSet.has(s)){
          points.push(newData[this.s2i[s]])
        }
      }
      if(points.length > 0){
        let centroid = math.mean(points, 0);
        h.centroid = centroid;
      }
    });
  }

  // def loadLayerFromSchema
  loadLayerFromSchema(schema, dir, epochIndex, archIndex, layerIndex, duration, shouldDisplay, callback){
    let display = ()=>{
      if(shouldDisplay){
        let prev = this.dataObj[this.epochIndexPrev][this.archIndexPrev][this.layerIndexPrev];
        let next = this.dataObj[epochIndex][archIndex][layerIndex];
        let prev_buffer = `data_${this.epochIndexPrev}_${this.archIndexPrev}_${this.layerIndexPrev}`;
        let next_buffer = `data_${epochIndex}_${archIndex}_${layerIndex}`;
        //wait until data is loaded from network
        let intervalId = window.setInterval(()=>{
          if(prev !== undefined 
          && next !== undefined 
          && prev.length > 0 
          && next.length > 0
          ){
            window.clearInterval(intervalId);
            this.transition(prev, next, prev_buffer, next_buffer, duration);
          }
        }, 50);
      }
    };

    if(this.dataObj[epochIndex] !== undefined
      && this.dataObj[epochIndex][archIndex] !== undefined
      && this.dataObj[epochIndex][archIndex][layerIndex] !== undefined){
      display();
      return;
    }


    if(!(epochIndex in this.dataObj)){
      this.dataObj[epochIndex] = {};
    }
    if(!(archIndex in this.dataObj[epochIndex])){
      this.dataObj[epochIndex][archIndex] = {};
    }
    let res = this.dataObj[epochIndex][archIndex]; //make a convenient reference
    if(!('centers' in res)){
      res.centers = {};
    }

     if(this.dataObj.attributes === undefined){
      this.dataObj.attributes = 'pending'; //avoid double exec
      d3.csv(this.attributeUrl)
      .then(attributes=>{
        this.dataObj.attributes = attributes;
        this.initAttributes(attributes);
      });
    }
    // if(this.dataObj.labels === undefined){
    //   //assuming labels are the same across archs
    //   this.dataObj.labels = '';
    //   let fn = `${dir}/${schema.labels.id}.bin`;
    //   fetch(fn)
    //   .then((response)=>response.arrayBuffer())
    //   .then((data)=>{
    //     data = Array.from(this.labelText.length > 10 ? new Uint16Array(data) : new Uint8Array(data)); //TODO fix me
    //     this.dataObj.labels = data;
    //     if(utils.isMobile()){          
    //       this.dataObj.labels = this.dataObj.labels.filter((_,i)=>this.sampleIndexSet.has(i));
    //     }
    //     this.updateLabel(this.dataObj.labels);
    //     this.labelSet = new Set(this.dataObj.labels);
    //     let labelList = Array.from(this.labelSet).sort((a,b)=>a-b);
    //     let labelText = this.labelText;
    //     labelText = labelText.filter((_,i)=>this.labelSet.has(i));
    //     this.updateSelectedLabels(labelList);
    //     this.initColorScale(labelList);
    //     this.initLegend(labelList, labelText);
    //     this.dataObj.colors = data.map(d=>this.sc(d));
    //     this.updateColor(this.dataObj.colors);
    //     this.setUI(this.styles.defaultUI);
    //   });
    // }

    res[layerIndex] = [];
    let layerId = schema.layers[layerIndex].id;
    let layerShape = schema.layers[layerIndex].shape;
    let fn = `${dir}/${layerId}.bin`;
    fetch(fn)
    .then((response)=>response.arrayBuffer())
    .then((data)=>{
      let d = Array.from(new Float32Array(data));
      d = utils.reshape(d, layerShape);
      if(utils.isMobile()){
        d = d.filter((_,i)=>this.sampleIndexSet.has(i));
      }
      //centralize
      let center = math.mean(d, 0);
      d = d.map(row=>numeric.sub(row, center));
      //spherize
      // let maxNorm = d3.max(d, d=>numeric.norm2(d));
      // let meanNorm = d3.mean(d, d=>numeric.norm2(d));
      // d = d.map(row=>{
      //   let norm = numeric.norm2(row);
      //   // let res = numeric.div(row, Math.sqrt(norm));
      //   let res = numeric.div(row, norm);
      //   // let k = 2/(1+Math.exp(-norm)) - 1;
      //   // let k = Math.tanh(norm/maxNorm*2)+1;
      //   // let k = Math.log(norm/maxNorm*20+1);
      //   let k = Math.sqrt(norm/meanNorm);
      //   res = numeric.mul(res, k);
      //   return res;
      // });

      res[layerIndex] = d;
      res.centers[layerIndex] = center;
      
      let bufferPrefix = `data_${epochIndex}_${archIndex}_${layerIndex}`;
      this.initPositionBuffer(bufferPrefix, d);
      //update handle centroids
      this.calculateHandleCentroid(d);

      if(this.hasStarted === undefined){ //first draw
        this.hasStarted = true;
        this.update({
          progress: 1.0, 
          dataPrev_buffer: bufferPrefix, 
          data_buffer: bufferPrefix,
          data: d,
          dataPrev: d,
          procrustes: this.procrustes,
        });
        this.resetZoom();
      }else{
        display();
      }

      if(this.animId === undefined){
        //initial animation
        //TODO move this elsewhere for a clearer logic
        this.animate(0.0);
        this.isGrandTourPlaying = true;
      }

      if(callback !== undefined){
        callback();
      }
    }); //end of utils.loadBin
    return res;
  }



  // setArchProgress(t=0){
  //   if(this.archIndexPrev !== undefined 
  //     && this.dataObj[this.archIndexPrev] !== undefined){
  //     this.dataObj.currentData = this.interpolate(this.dataObj.bed, this.dataObj.traveler, t);
  //     this.updatePosition(0, this.dataObj.currentData);
  //   }
  // }



  // animateArch(duration){

  //   let bed = this.dataObj[this.epochIndex][this.archIndexPrev][this.layerIndex];
  //   let traveler = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
  //   let procrustes = utils.orthogonal_procrustes(traveler, bed, 1000);
  //   this.gt.matrix = numeric.dot(this.procrustes, this.gt.matrix);
  //   this.procrustes = procrustes;
  //   this.progress = 0.0; // for this.animate()
  //   this.update({
  //     progress: this.progress, 
  //     data: traveler, 
  //     dataPrev: bed,
  //     procrustes: this.procrustes,
  //   });

  //   let t0 = performance.now();
  //   let tick = ()=>{
  //     this.archAnimId = requestAnimationFrame((now)=>{
  //       let dt = now - t0;
  //       let progress = dt / duration;
  //       if(progress < 0){
  //         tick();
  //       }else if(progress > 0 && progress < 1){
  //         this.progress = progress;
  //         this.update({
  //           progress:this.progress
  //         });
  //         tick();
  //       }else{
  //         this.progress = 1.0;
  //         this.update({
  //           progress:this.progress
  //         });
  //         cancelAnimationFrame(this.archAnimId);
  //       }
  //     });
  //   };
  //   tick();
  // }


  updateScale({xDataMin, xDataMax, yDataMin, yDataMax, zDataMin=0, zDataMax=1}){

    this.sx
    .domain([xDataMin, xDataMax])
    .range([0, this.canvas.attr('width')/devicePixelRatio]);
    this.sy
    .domain([yDataMin, yDataMax])
    .range([this.canvas.attr('height')/devicePixelRatio, 0]);

    //handle zoom event;
    this.sx = this.transform.rescaleX(this.sx);
    this.sy = this.transform.rescaleY(this.sy);

    update_uniform(this.gl, 'xDataMin', this.sx.domain()[0]);
    update_uniform(this.gl, 'xDataMax', this.sx.domain()[1]);
    update_uniform(this.gl, 'yDataMin', this.sy.domain()[0]);
    update_uniform(this.gl, 'yDataMax', this.sy.domain()[1]);
    
    if(zDataMin !== undefined){
      update_uniform(this.gl, 'zDataMin', zDataMin);
    }
    if(zDataMax !== undefined){
      update_uniform(this.gl, 'zDataMax', zDataMax);
    }

    
  }


  // updateHighlight(forceShow=false){
  //   if(this.highlightIndex !== undefined){
  //     this.highlight(this.highlightIndex);
  //   }
  //   if(this.highlightIndex !== undefined || forceShow){  
  //     this.imageGroupDisplay = '';
  //   }else{
  //     this.imageGroupDisplay = 'none';
  //   }
  //   this.imageGroup.attr('display', this.imageGroupDisplay);
  //   this.highlightCircle.attr('display', this.imageGroupDisplay);
  // }
  
  // def render
  render(dt=0.0){
    this.update({
      dt: dt, 
    });
  }


  drawFps(fps){
    this.fpsText
    .text(`${fps.toFixed(2)} FPS`);
  }


  // def animate
  animate(t){
    if (this.t === undefined){
      this.t = t || 0;
    }
    let dt = t - this.t;

    //FPS
    if(dt > 0){
      if(this.anotherView !== undefined && this.alignmentMode === 'follower'){
        this.fps = 0;
      }else{
        this.fps = 0.7*(this.fps||0) + 0.3*(1000 / (dt+1e-4));
        this.drawFps(this.fps);
      }
    }else{
      this.fps = 0;
      this.drawFps(this.fps);
    }
    

    if(this.shouldRender){
      if(this.anotherView !== undefined && this.alignmentMode == 'follower'){
        dt = 0;
      }
      this.render(dt);
    }
    this.t += dt; // internal clock
    this.animId = requestAnimationFrame(this.animate.bind(this));
  }


  pause(){
    this.gt.STEPSIZE = 0;
    this.shouldRender = false;
  }

  play(){
    this.gt.STEPSIZE = this.gt.STEPSIZE0;
    this.shouldRender = true;
  }

  initPositionBuffer(buffer_name_prefix, data){
    for(let i=0; i<Math.ceil(data[0].length/4); i++){
      let position_i = data.map(row=>row.slice(i*4,i*4+4));
      init_buffer_with_data(this.gl, `${buffer_name_prefix}_${i}`, position_i);
    }
  }

  updatePosition(buffer_name_prefix){
    let dim = 4;
    let n = Math.ceil(this.ndim / 4);
    for(let i=0; i<4; i++){
      if(i==n-1){
        dim = this.ndim % 4;
      }
      update_attribute(this.gl, `position_${i}`, `${buffer_name_prefix}_${i}`, dim);
    }
  }

  updatePositionPrev(buffer_name_prefix){
    let dim = 4;
    let n = Math.ceil(this.ndim / 4);
    for(let i=0; i<4; i++){
      if(i==n-1){
        dim = this.ndim % 4;
      }
      update_attribute(this.gl, `position_prev_${i}`, `${buffer_name_prefix}_${i}`, dim);
    }
  }

  // updatePositionPrev(dataPrev){
  //   for(let i=0; i<Math.ceil(dataPrev[0].length/4); i++){
  //     let position_i = dataPrev.map(row=>row.slice(i*4,i*4+4));
  //     update_data(this.gl, `position_prev_${i}`, position_i);
  //   }
  // }




  updateProgress(t){
    update_uniform(this.gl, 't', t);
  }


  updatePreprocess(matrix){
    let matricies = utils.split_matrix(matrix);
    for(let i=0; i<matricies.length; i++){
      update_uniform(this.gl, `preprocess[${i}]`, matricies[i]);
    }
  }


  updateProcrustes(matrix){
    let matricies = utils.split_matrix(matrix);
    for(let i=0; i<matricies.length; i++){
      update_uniform(this.gl, `procrustes[${i}]`, matricies[i]);
    }
  }


  updateProcrustesPrev(matrix){
    let matricies = utils.split_matrix(matrix);
    for(let i=0; i<matricies.length; i++){
      update_uniform(this.gl, `procrustes_prev[${i}]`, matricies[i]);
    }
  }


  updateGrandTour(matrix){
    let matricies = utils.split_matrix(matrix);
    for(let i=0; i<matricies.length; i++){
      update_uniform(this.gl, `gt_matrix[${i}]`, matricies[i]);
    }
  }


  updatePostprocess(matrix){
    let matricies = utils.split_matrix(matrix.map(row => row.slice(0,4)));
    for(let i=0; i<matricies.length; i++){
      update_uniform(this.gl, `postprocess[${i}]`, matricies[i]);
    }
  }


  updateLabel(labels){
    update_data(this.gl, 'a_label', labels);
  }

  updateSelectedLabels(labels){
    labels = Array.from(labels);
    for(let i=0; i<labels.length; i++){
      update_uniform(this.gl, `selected_labels[${i}]`, labels[i]);
    }
    update_uniform(this.gl, `selected_labels[${labels.length}]`, -1.0);
  }


  getScale({xMax,yMax, xMaxPrev,yMaxPrev, zExtent,zExtentPrev, progress}){
    //recalculate scale:

    let xMax_t = xMax * progress + xMaxPrev * (1-progress);
    let yMax_t = yMax * progress + yMaxPrev * (1-progress);
    let zMin_t = zExtent[0] * progress + zExtentPrev[0] * (1-progress);
    let zMax_t = zExtent[1] * progress + zExtentPrev[1] * (1-progress);

    let xExtent = [-xMax_t, xMax_t];
    let yExtent = [-yMax_t, yMax_t];
    let xRange = xExtent[1] - xExtent[0];
    let yRange = yExtent[1] - yExtent[0];

    // let width = parseInt(this.canvas.style('width'));
    // let height = parseInt(this.canvas.style('height'));
    let [width, height] = this.getWidthHeight();
    if(xRange/yRange > width/height){
      let yCenter = (yExtent[0] + yExtent[1]) / 2;
      yRange = xRange / width * height;
      yExtent[0] = yCenter - yRange/2;
      yExtent[1] = yCenter + yRange/2;
    }else{
      let xCenter = (xExtent[0] + xExtent[1]) / 2;
      xRange = yRange / height * width;
      xExtent[0] = xCenter - xRange/2;
      xExtent[1] = xCenter + xRange/2;
    }
    let margin = 0.1;

    return {
      xDataMin: (xExtent[0] - xRange*margin),
      xDataMax: (xExtent[1] + xRange*margin),
      yDataMin: (yExtent[0] - yRange*margin),
      yDataMax: (yExtent[1] + yRange*margin),
      zDataMin: zMin_t,
      zDataMax: zMax_t,
    };
  }


  drawPoints(n){
    let gl = this.gl;
    clear(gl, [...this.bg_color, 1.0]);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.drawArrays(gl.POINTS, 0, n);
    // 
    // for(let i=0; i<this.imageUrls.length; i++){
    //   if(this.pointMode === 'image'){
    //     let texture = utils.loadTexture(this.gl, this.imageUrls[i], `imageTexture_${i}`, i);
    //   }
    //   gl.drawArrays(gl.POINTS, this.batch[i].start, this.batch[i].count);
    // }

  }


  updateBrush(brushIndex, brushBox){
    update_uniform(this.gl, `brush_${brushIndex}`, brushBox);
  }


  updatePointMode(mode){
    if (typeof(mode) === 'string'){
      mode = (mode === 'point') ? 0:1;
      mode = Array(this.sampleSize).fill(mode);
    }
    update_data(this.gl, 'a_mode', mode);
  }


  computeExtent(data, dataPrev, data_buffer, dataPrev_buffer){
    if(this.dataObj.extent === undefined){
      this.dataObj.extent = {};
    }
    let maxFunc = (d)=>numeric.norm2(d);
    if(this.dataObj.extent[data_buffer] === undefined){
      // this.xMax = d3.max(data, d=>maxFunc(d));
      this.xMax = math.max(data.map(d=>math.norm(d)));
      this.yMax = this.xMax;
      this.zExtent = [-this.xMax, this.xMax];
      this.dataObj.extent[data_buffer] = {
        xMax: this.xMax,
        yMax: this.yMax,
        zExtent: this.zExtent,
      };
    }else{
      this.xMax = this.dataObj.extent[data_buffer].xMax;
      this.yMax = this.dataObj.extent[data_buffer].yMax;
      this.zExtent = this.dataObj.extent[data_buffer].zExtent;
    }
    if(this.dataObj.extent[dataPrev_buffer] === undefined){
      this.xMaxPrev = d3.max(data, d=>maxFunc(d));
      this.yMaxPrev = this.xMaxPrev;
      this.zExtentPrev = [-this.xMaxPrev, this.xMaxPrev];
      this.dataObj.extent[dataPrev_buffer] = {
        xMax: this.xMaxPrev,
        yMax: this.yMaxPrev,
        zExtent: this.zExtentPrev,
      };
    }else{
      this.xMaxPrev = this.dataObj.extent[dataPrev_buffer].xMax;
      this.yMaxPrev = this.dataObj.extent[dataPrev_buffer].yMax;
      this.zExtentPrev = this.dataObj.extent[dataPrev_buffer].zExtent;
    }
  }


  computeHandleMax(data, dataPrev, data_buffer, dataPrev_buffer){
    let maxFunc = (d)=>numeric.norm2(d);
    if(this.dataObj.handleMax === undefined){
      this.dataObj.handleMax = {};
    }

    if(this.dataObj.handleMax[data_buffer] === undefined){
      this.handleMax0 = d3.max(data, row=>maxFunc(row));
      this.dataObj.handleMax[data_buffer] = this.handleMax0;
    }else{
      this.handleMax0 = this.dataObj.handleMax[data_buffer];
    }

    if(this.dataObj.handleMax[dataPrev_buffer] === undefined){
      this.handleMaxPrev = d3.max(dataPrev, row=>maxFunc(row));
      this.dataObj.handleMax[dataPrev_buffer] = this.handleMaxPrev;
    }else{
      this.handleMaxPrev = this.dataObj.handleMax[dataPrev_buffer];
    }
  }




  


  // get state(){
  //   let orientation = this.orientation;
  //   let epoch = this.epochIndex;
  //   let arch = this.archIndex;
  //   let layer = this.layerIndex;
  //   let labelFilter = new Set();
  //   let brushFilter = new Set();
  //   return {
  //     orientation,
  //     epoch,
  //     arch,
  //     layer,
  //     labelFilter,
  //     brushFilter,
  //   };
  // }


  //def update
  update({
    dataPrev, data, 
    dataPrev_buffer, data_buffer, 
    preprocess,
    procrustesPrev, procrustes, 
    progress, dt, 
    grandtour, 
    postprocess, //for direct manipulation
    brush0, brush1, 
    isBrushing, isBrushed,
    pointMode,
  }){
    

    //data pipeline
    if(preprocess !== undefined){
      this.updatePreprocess(preprocess);
    }
    if(procrustes !== undefined){
      this.updateProcrustes(procrustes);
    }
    if(procrustesPrev !== undefined){
      this.updateProcrustesPrev(procrustesPrev);
    }

    if(postprocess !== undefined){
      this.updatePostprocess(postprocess);
    }
    if(grandtour !== undefined){
      this.updateGrandTour(grandtour);
    }else if(dt !== undefined){ //grand tour step
      this.gt.step2(dt / Math.pow(this.zoomFactor, 0.7) );
      // this.gt.step2(dt / Math.log(this.zoomFactor+1)*3 );
      this.updateGrandTour(this.gt.matrix);
    }
    // let post;
    // if(postprocess !== undefined){
    //   post = postprocess;
    //   // this.updatePostprocess(postprocess);
    // }else{
    //   post = this.postprocess;
    // }
    // if(grandtour !== undefined){
    //   // this.updateGrandTour(grandtour);
    //   post = numeric.dot(grandtour, post);
    // }else if(dt !== undefined && dt > 0){ //grand tour step
    //   this.gt.step2(dt);
    //   // this.updateGrandTour(this.gt.matrix);
    //   post = numeric.dot(this.gt.matrix, post);
    // }else{
    //   post = numeric.dot(this.gt.matrix, post);
    // }
    // this.updatePostprocess(post);
    
    


    if(pointMode !== undefined){
      this.updatePointMode(pointMode);
    }

    if(data_buffer !== undefined){
      this.updatePosition(data_buffer);
    }
    if(dataPrev_buffer !== undefined){
      this.updatePositionPrev(dataPrev_buffer);
    }
    if(brush0 !== undefined){
      this.updateBrush(0, brush0);
    }
    if(brush1 !== undefined){
      this.updateBrush(1, brush1);
    }
    if(isBrushing !== undefined){
      update_uniform(this.gl, `is_brushing`, isBrushing);
    }
    if(isBrushed !== undefined){
      update_data(this.gl, `is_brushed`, isBrushed);
    }
    
    
    if(data !== undefined 
    && dataPrev !== undefined){
      this.computeExtent(data, dataPrev, data_buffer, dataPrev_buffer);
      this.computeHandleMax(data, dataPrev, data_buffer, dataPrev_buffer);
    }


    if(progress !== undefined){
      this.updateProgress(progress);
      this.scales = this.getScale({
        xMax: this.xMax,
        yMax: this.yMax,
        xMaxPrev: this.xMaxPrev,
        yMaxPrev: this.yMaxPrev,
        zExtent: this.zExtent,
        zExtentPrev: this.zExtentPrev,
        progress: progress,
      });
      this.updateScale(this.scales);
    }

    

    

    

    //draw on canvas
    this.drawPoints(this.sampleSize);

    //update overlay(svg)
    if(progress !== undefined){
      this.handleMax = this.handleMaxPrev * (1-progress) + this.handleMax0 * progress;
    }
    this.updateHandlePosition();
  }


  updateColor(color){
    update_data(this.gl, 'a_color', color);
    this.render();
  }


  interpolate(x, y, t){
    return numeric.add(numeric.mul(x, 1-t), numeric.mul(y, t));
  }

  resize(width, height, left, top=0){
    this.canvas
    .attr('width', width * window.devicePixelRatio)
    .attr('height', height * window.devicePixelRatio)
    .style('width', `${width}px`)
    .style('height', `${height}px`)
    .style('left', `${left}px`);
    this.svg
    .style('width', `${width}px`)
    .style('height', `${height}px`)
    .style('left', `${left}px`);
    try{
      this.scales = this.getScale({
        xMax: this.xMax,
        yMax: this.yMax,
        xMaxPrev: this.xMaxPrev,
        yMaxPrev: this.yMaxPrev,
        zExtent: this.zExtent,
        zExtentPrev: this.zExtentPrev,
        progress: this.progress,
      });
      this.updateScale(this.scales);
    }catch(error){
      // in case this.zExtentPrev is undefined
      console.warn(error);
    }
    this.sxWebgl = undefined; //for brush
    this.repositionAll();
  }


  repositionAll(){
    this.repositionLayerControls();
    this.repositionResetZoomButton();
    this.repositionFps();
    this.repositionLegends();
    this.repositionHelpButton();


  }

  repositionHelpButton(){
    this.initHelpButton();
  }


  repositionLegends(){
    let [width, height] = this.getWidthHeight();
    let lbb = this.legendBoundingBox;
    let left = width - lbb.marginRight - lbb.width;
    let top = height - lbb.marginBottom - lbb.height;

    this.gLegend
    .attr('transform', `translate(${left},${top})`);
  }

  repositionFps(){
    let [width, height] = this.getWidthHeight();
    this.fpsText
    .attr('y', height-50)
    .attr('x', 20);
  }


  repositionLayerControls(){
    let key = `${this.epochIndex},${this.archIndex}`;
    try{
      let schema = this.dataObj.schemas[key];
      this.initLayerControls(schema, this.layerIndex);
    }catch(error){
      // in case schema is undefined
      console.warn(error);
    }
  }


  repositionResetZoomButton(){
    let [width, height] = this.getWidthHeight();
    let radius = this.styles.resetRadius/800*height;
    let margin = this.styles.marginRight - radius;
    //translate
    let tx = width - margin - radius*2;
    let ty = height - this.styles.marginBottom;

    this.gResetZoom
    .attr('transform',`translate(${tx},${ty})`);


  }




  



  // animateLayer(layerIndex, duration){
  //   duration = duration || this.layerTransitionTime;
  //   if(layerIndex === this.layerIndex){
  //     return;
  //   }
  //   this.layerIndex = layerIndex;
  //   console.log(`${this.layerIndexPrev} -> ${layerIndex}`);
  //   let prev = this.dataObj[this.epochIndex][this.archIndex][this.layerIndexPrev];
  //   let next = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
  //   let traveler = next;
  //   let bed = prev;
  //   let procrustes = utils.orthogonal_procrustes(traveler, bed, 1000);
    
  //   this.gt.matrix = numeric.dot(this.procrustes, this.gt.matrix);

  //   this.procrustes = procrustes;
  //   this.progress = 0.0; // for this.animate()
  //   this.update({
  //     progress: this.progress, 
  //     data: traveler, 
  //     dataPrev: bed,
  //     procrustes: this.procrustes,
  //     grandtour: this.gt.matrix,
  //   });
  //   // this.shouldRender = true;

  //   let t0 = performance.now();
  //   let tick = ()=>{
  //     this.layerAnimId = requestAnimationFrame((now)=>{
  //       let dt = now-t0;
  //       let progress = dt / duration;
  //       if(progress<=0){
  //         tick();
  //       }else if(progress > 0 && progress < 1){
  //         this.progress = progress;
  //         this.update({
  //           progress:this.progress
  //         });
  //         tick();
  //       }else if (progress >= 1){
  //         this.progress = 1.0;
  //         this.update({
  //           progress:this.progress
  //         });
  //         cancelAnimationFrame(this.layerAnimId);
  //         this.layerIndexPrev = this.layerIndex;
  //       }
  //     });
  //   };
  //   tick();
  // }


  filter(selectedPoints){
    this.selectedPoints = selectedPoints;
    let s = new Set(this.selectedPoints);
    this.isBrushed = d3.range(this.sampleSize).map(i=>s.has(i)?1:-1);
    if(this.selectedPoints.length > 0){
      this.updateLegendSize(this.isBrushed);
      this.brushController.on('end', {
        gv: this, 
      });
    }
  }


  project(data, canvas=true){
    if(typeof(data[0]) === 'number'){
      data = [data];
    }
    let pos = numeric.dot(data, this.preprocess);
    pos = numeric.dot(pos, this.procrustes);
    pos = numeric.dot(pos, this.gt.matrix);
    pos = numeric.dot(pos, this.postprocess);//in data coord
    if(canvas){
      pos = pos.map(d=>[this.sx(d[0]), this.sy(d[1])]);//in canvas coord
    }
    return pos;
  }

  initBrush(){
    this.svg.selectAll('.brush')
    .data([0])
    .enter()
    .append('g')
    .attr('id', 'brush')
    .attr('class', 'brush');
    let gBrush = this.svg.select('#brush')
    .attr('display', 'none');

    this.gBrush = gBrush;
    this.update({
      isBrushing: -1.0,
      isBrushed: Array(this.sampleSize).fill(1.0),
    });

    this.brush = d3.brush()
    .on('start', ()=>{
      this.shouldRender0 = this.shouldRender;
      this.shouldRender = true;
      gBrush.attr('opacity', 1.0);
    })
    .on('brush', ()=>{
      let selection = d3.event.selection;
      if(selection === null){
        return;
        // gBrush.call(brush.move, null);
      }else{
        let [[x0,y0], [x1, y1]] = selection;
        if(this.sxWebgl === undefined){ 
          //lazy init
          this.sxWebgl = d3.scaleLinear()
          .domain([0,this.svg.node().getBoundingClientRect().width])
          .range([-1,1]);
          this.syWebgl = d3.scaleLinear()
          .domain([0,this.svg.node().getBoundingClientRect().height])
          .range([1,-1]);
        }
        this.brushBox = {x0,x1,y0,y1};
        x0 = this.sxWebgl(x0);
        x1 = this.sxWebgl(x1);
        y0 = this.syWebgl(y0);
        y1 = this.syWebgl(y1);
        if(y1 < y0){
          let a = y1;
          y1 = y0;
          y0 = a;
        }
        this.brushBoxWebgl = {x0,x1,y0,y1};
        this.brushController.on('brush', {
          gv: this, 
          brushBoxWebgl: this.brushBoxWebgl
        });
      }
      // brush.on('end')();
    })
    .on('end', ()=>{
      this.shouldRender = this.shouldRender0;
      delete this.shouldRender0;  
      let optionType = this.options[this.currentOption].type;

      let selection = d3.event.selection;
      if(selection === null){
        this.clearBrush();
      }else{
        let data = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
        let pos = this.project(data, true); //in canvas coordinate
        let isBrushed = pos.map(d=>{
          return (d[0] > this.brushBox.x0
          && d[0] < this.brushBox.x1
          && d[1] > this.brushBox.y0
          && d[1] < this.brushBox.y1) ? 1.0 : -1.0;
        });
        this.isBrushed = isBrushed;

        if (optionType === 'categorical' || optionType === 'ordinal'){
          this.selectedPoints = d3.range(this.sampleSize).filter((_,i)=>{
            let attrValue = this.dataObj.attributes[i][this.currentAttribute];
            let index = this.attributes[this.currentAttribute].domain2index[attrValue];
            // let index = this.attributes[this.currentAttribute].domain.indexOf(
            //   this.dataObj.attributes[i][this.currentAttribute]
            // );
            return (
              this.selectedLabels.size == 0 
              || this.selectedLabels.has(index)
              ) 
              && this.isBrushed[i]>0;
          });
        }else{
          //TODO consider the selection in legend
          this.selectedPoints = d3.range(this.sampleSize).filter((_,i)=>{
            return this.isBrushed[i]>0;
          });
        }
        console.log(JSON.stringify(this.selectedPoints));

        if(this.brushMode === 'filter'){
          if(this.selectedPoints.length > 0){
            if (optionType === 'categorical' || optionType === 'ordinal'){
              this.updateLegendSize(isBrushed);
            }else if(optionType === 'continuous'){
              //TODO
            }
            this.brushController.on('end', {
              gv: this, 
            });
          }else{
            this.clearBrush();
          }
        }else if (this.brushMode === 'direct-manipulation'){
          let n = this.selectedPoints.length;
          if(n>0){

            let centroid = math.mean(this.selectedPoints.map(i=>data[i]), 0);
            this.dmCentroid = centroid;
            this.handleData.push({
              centroid: centroid,
              centroidPrev: centroid,
              selection: this.selectedPoints,
              radius: 10.0,
              radiusMax: 80.0,
              text: `${this.handleData.length+1}`,
              // text: ``,
              // textOffset: [0, -1.1],
              textOffset: [0, 0],
              handleLine: true,
              highlight: true,
              isEditable: true,
            });
            this.annotationHandleData = this.annotationData.concat(this.handleData);
            this.initHandle(this.annotationHandleData);

            if(this.anotherView !== undefined){
              let data = this.anotherView.dataObj[this.anotherView.epochIndex][this.anotherView.archIndex][this.anotherView.layerIndex];
              let centroid = math.mean(this.selectedPoints.map(i=>data[i]), 0);
              this.anotherView.handleData.push({
                centroid: centroid,
                centroidPrev: centroid,
                selection: this.selectedPoints,
                radius: 10.0,
                radiusMax: 80.0,
                text: `${this.anotherView.handleData.length+1}`,
                // textOffset: [0, -1.1],
                textOffset: [0, 0],
                handleLine: true,
                highlight: true,
              });
              this.anotherView.annotationHandleData = this.anotherView.annotationData.concat(this.anotherView.handleData);
              this.anotherView.initHandle(
                this.anotherView.annotationHandleData
              );
            }

          }
          this.clearBrush();
        }
      }
      //hide brush
      // gBrush.attr('opacity', 0.001);
      gBrush.attr('display', 'none');
      // gBrush.call(this.brush.move, null);
      gBrush.selectAll('.selection, .handle')
      .attr('x', -1e9)
      .attr('y', -1e9);
    });
    gBrush.call(this.brush);
  }
  
  clearBrush(){
    this.isBrushed = Array(this.sampleSize).fill(1.0);
    this.brushController.on('end', {
      gv: this, 
    });
    this.legendMarkers
    .attr('r', this.markerRadius);
  }

  updateLegendSize(isBrushed){
    let labels = this.dataObj.attributes.filter((d,i)=>isBrushed[i] > 0).map(d=>d[this.currentAttribute]);
    this.hist = utils.counter(labels);
    this.sr = d3.scaleLinear()
    .domain([0, d3.max(Object.values(this.hist)) || 1])
    .range([1, Math.pow(this.markerRadius*1.5, 2)]);

    this.legendMarkers
    .attr('r', d=>Math.sqrt(this.sr(this.hist[d.label] || 0)));
  }


  

  getRotationMatrix(p0, p1){
    let ndim = p0.length;
    //normalize
    p0 = numeric.div(p0, numeric.norm2(p0));
    p1 = numeric.div(p1, numeric.norm2(p1));
    let cos = numeric.dot(p0, p1);
    let sin = Math.sqrt(1 - cos*cos);

    //change of basis matrix
    let Q = d3.range(ndim).map(row=>{
      return d3.range(ndim).map(d=>Math.random());
    });
    Q[0] = p0;
    Q[1] = p1;
    Q = utils.orthogonalize(Q);
    let Q_inv = numeric.inv(Q);
    let rot = math.identity(ndim)._data;
    rot[0][0] = cos;
    rot[0][1] = sin;
    rot[1][0] = -sin;
    rot[1][1] = cos;
    let res = numeric.dot(Q_inv, rot);
    res = numeric.dot(res, Q);
    return res;
  }


  clearHandle(){
    this.handleData = [];
    // this.annotationData = [];
    this.annotationHandleData = this.annotationData.concat(this.handleData);
    this.initHandle(this.annotationHandleData);
  }

  removeLastHandle(){
    this.handleData.pop()
    this.annotationHandleData = this.annotationData.concat(this.handleData);
    this.initHandle(this.annotationHandleData);
  }

  // clearAnnotation(){
  //   this.annotationData = [];
  //   this.initHandle(this.handleData.concat(this.annotationData));
  // }


  enableHandleInteraction(){
    this.handles.on('mouseover', (d,i)=>{
      if(d.selection.length > 0 && d.highlight){
        let selection = new Set(d.selection);
        let isSelected = d3.range(this.sampleSize).map((d,i)=>{
          return selection.has(this.sampleIndices[i]) ? 1.0: -1.0;
        });
        this.update({
          isBrushed: isSelected,
        });
        if(this.anotherView !== undefined){
          this.anotherView.update({
            isBrushed: isSelected,
          });
        }
      }
      this.handleLines.attr('opacity', (_,j)=>j==i?this.styles.opacity['handleLine']:0.0);
    })
    .on('mouseout', ()=>{
      this.clearBrush();
      this.handleLines.attr('opacity', 0);
    });
  }


  clearHandleInteraction(){
    this.handles
    .on('mouseover', null)
    .on('mouseout', null);
  }


  // def initHandle
  initHandle(handleData){
    // this.handleMax = this.handleScale;

    this.svg.selectAll('.handleLine')
    .data(handleData)
    .exit()
    .remove();
    this.svg.selectAll('.handleLine')
    .data(handleData)
    .enter()
    .append('line')
    .attr('class', 'handleLine')
    .attr('stroke', '#fff')
    .attr('stroke-linecap','round')
    .attr('opacity', 0); //hide the line by default
    this.handleLines = this.svg.selectAll('.handleLine');

    this.svg.selectAll('.dm-handle')
    .data(handleData)
    .exit()
    .remove();
    this.svg.selectAll('.dm-handle')
    .data(handleData)
    .enter()
    .append('circle')
    .attr('class', 'dm-handle')
    .attr('paint-order', 'stroke')
    .style('filter', 'url(#whiteOutlineEffect)')
    .style('cursor', 'grab');
    this.handles = this.svg.selectAll('.dm-handle');


    // this.svg.selectAll('.handleText')
    // .data(handleData)
    // .exit()
    // .remove();
    // this.svg.selectAll('.handleText')
    // .data(handleData)
    // .enter()
    // .append('text')
    // .attr('class', 'handleText')
    // .attr('fill', '#fff')
    // .attr('opacity', 1.0);
    // this.handleTexts = this.svg.selectAll('.handleText')
    // .text(d=>d.text);
    this.handleTextOverlay.selectAll('.handleText')
    .data(handleData)
    .exit()
    .remove();
    this.handleTextOverlay.selectAll('.handleText')
    .data(handleData)
    .enter()
    .append('p')
    .attr('class', 'handleText')
    .style('color', '#fff')
    .style('opacity', 0.9);
    this.handleTexts = this.handleTextOverlay.selectAll('.handleText')
    .attr('contentEditable', d=>d['isEditable']!==undefined?d['isEditable']:true)
    .style('cursor', d=>{
      if(d.isEditable===undefined || d.isEditable){
        return 'cursor';
      }else{
        return 'default';
      }
    })
    .style('filter', 'url(#whiteOutlineEffect)')
    .text((d,i)=>d.text)
    ////slow down the grand tour when hovering over editable texts
    // .on('mouseover', (d)=>{
    //   if(d.isEditable){
    //     this.gt.STEPSIZE1 = this.gt.STEPSIZE;
    //     this.gt.STEPSIZE *= 0.1;
    //   }
    // })
    // .on('mouseout', (d)=>{
    //   if(d.isEditable){
    //     this.gt.STEPSIZE = this.gt.STEPSIZE1;
    //   }
    // });

    //update handleData when user edits the name
    this.handleTexts.each(function(d,i){
      d3.select(this).node()
      .addEventListener('input', ()=>{
        d.text = d3.select(this).text();
      }, false);
    });


    
    //handle interactions
    this.enableHandleInteraction();

    //dragging event handler
    let that = this;
    let drag = d3.drag()
    .on('start', (d, i)=>{
      this.gtStepSize0 = this.gt.STEPSIZE;
      this.gt.STEPSIZE = 0;
      this.shouldRender0 = this.shouldRender;
      this.shouldRender = true;
      if(this.anotherView !== undefined){
        this.anotherView.shouldRender = true;
        this.anotherView.alignWith(this);
      }

      //highlight the points that formed this handle
      if(d.selection.length > 0 && d.highlight){
        let selection = new Set(d.selection);
        let isSelected = d3.range(this.sampleSize).map((d,i)=>{
          return selection.has(i) ? 1.0: -1.0;
        });

        this.update({
          isBrushed: isSelected,
        });
        if(this.anotherView !== undefined){
          this.anotherView.update({
            isBrushed: isSelected,
          });
        }

      }
      this.clearHandleInteraction();
      this.handleLines.attr('opacity', (_,j)=>j==i?this.styles.opacity['handleLine']:0.0);
    })
    .on('drag', (d, i)=>{
      if(d3.event.dx==0 && d3.event.dy==0){
          return;
      }
      let sx = that.sx;
      let sy = that.sy;
      let matrix = this.gt.matrix;
      // let vmax = this.handleMax;
      let dx = sx.invert(d3.event.dx) - sx.invert(0);
      let dy = sy.invert(d3.event.dy) - sy.invert(0);

      // Option 1: direct manipulation for basis vectors
      // matrix[i][0] += dx/vmax;
      // matrix[i][1] += dy/vmax;
      // matrix = utils.orthogonalize(matrix, i);
      
      // Option 2: direct manipulation for arbitrary vectors
      let p0 = numeric.dot(d.centroid, this.preprocess);
      p0 = numeric.dot(p0, this.procrustes);
      p0 = numeric.dot(p0, matrix);
      p0 = numeric.dot(p0, this.postprocess);
      let p1 = p0.slice();
      p1[0] += dx;
      p1[1] += dy;

      // let gt2 = this.getRotationMatrix(p0, p1);
      // this.gt.matrix = numeric.dot(matrix, gt2);
      let rot = this.getRotationMatrix(p0, p1);
      this.postprocess = numeric.dot(this.postprocess, rot);
      this.update({
        postprocess: this.postprocess,
      });
      this.updateHandlePosition();


      if(this.anotherView !== undefined){
        this.anotherView.postprocess = this.postprocess;
        this.anotherView.update({
          postprocess: this.postprocess,
        });
        this.anotherView.updateHandlePosition();
      }
    })
    .on('end', ()=>{
      this.shouldRender = this.shouldRender0;
      if(this.anotherView !== undefined){
        this.anotherView.shouldRender = this.shouldRender0;
      }
      delete this.shouldRender0;
      this.gt.STEPSIZE = this.gtStepSize0;
      delete this.gtStepSize0;
      
      this.clearBrush();
      if(this.anotherView !== undefined){
        this.anotherView.clearBrush();
      }

      this.handleLines.attr('opacity', 0.0);
      this.enableHandleInteraction();
    });
    this.handles.call(drag);
  }


  resetOrientation(duration = 500){
    if(this.anotherView === 'undefined'){
      this.setOrientation({
        preprocess: math.identity(this.ndim)._data,
        grandtour: this.gt.matrix,
        procrustes: math.identity(this.ndim)._data,
        postprocess: math.identity(this.ndim)._data,
        grandtour_thetas: this.gt.thetas,
        grandtour_t: this.gt.t,
      }, duration);
    }else{
      if(this.alignmentMode === 'leader'){
        this.setOrientation({
          preprocess: math.identity(this.ndim)._data,
          grandtour: this.gt.matrix,
          procrustes: this.procrustes,
          postprocess: this.postprocess,
          grandtour_thetas: this.gt.thetas,
          grandtour_t: this.gt.t,
        }, duration);
      }else if(this.alignmentMode === 'follower'){
        this.setOrientation({
          preprocess: math.identity(this.ndim)._data,
          grandtour: this.anotherView.gt.matrix,
          procrustes: this.anotherView.procrustes,
          postprocess: this.anotherView.postprocess,
          grandtour_thetas: this.anotherView.gt.thetas,
          grandtour_t: this.anotherView.gt.t,
        }, duration);
      }
    }
    
    
  }


  alignWith(another, duration = 100){
    let traveler = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
    let bed = another.dataObj[another.epochIndex][another.archIndex][another.layerIndex];
    let Q = utils.orthogonal_procrustes(traveler, bed, 2000);
    let preprocess = numeric.dot(Q, another.preprocess);
    this.setOrientation({
      preprocess: preprocess,
      grandtour: this.gt.matrix,
      procrustes: another.procrustes,
      postprocess: another.postprocess,
      grandtour_thetas: this.gt.thetas,
      grandtour_t: this.gt.t,
    }, duration);
    this.alignmentMode = 'follower';
    another.alignmentMode = 'leader';
  }

  // alignWith(another, duration){
  //   let traveler = this.dataObj[this.epochIndex][this.archIndex][this.layerIndex];
  //   let bed = another.dataObj[another.epochIndex][another.archIndex][another.layerIndex];

  //   let Q = utils.orthogonal_procrustes(traveler, bed, 2000);
  //   this.preprocess = numeric.dot(Q, another.preprocess);
  //   this.procrustes = another.procrustes;
  //   this.postprocess = another.postprocess;
  //   // this.procrustesPrev = another.procrustesPrev;
  //   this.update({
  //     preprocess: this.preprocess,
  //     procrustes: this.procrustes,
  //     // procrustesPrev: this.procrustesPrev,
  //     postprocess: this.postprocess,
  //   });
  //   this.alignmentMode = 'follower';
  //   another.alignmentMode = 'leader';
  // }

  // def updateHandlePosition
  updateHandlePosition(){
    let data = this.annotationHandleData;
    if(data.length > 0){
      let handlePosition;
      if(data[0].centroidPrev !== undefined){
        let h0 = data.map(d=>d.centroidPrev);
        let h1 = data.map(d=>d.centroid);
        h0 = numeric.dot(h0, this.preprocess);
        h1 = numeric.dot(h1, this.preprocess);
        h0 = numeric.dot(h0, this.procrustesPrev);
        h1 = numeric.dot(h1, this.procrustes);
        handlePosition = numeric.add(
          numeric.mul(h0, (1-this.progress)), 
          numeric.mul(h1, this.progress), 
        );
      }else{
        handlePosition = data.map(d=>d.centroid);
        handlePosition = numeric.dot(handlePosition, this.preprocess);
        handlePosition = numeric.dot(handlePosition, this.procrustes);
      }
      handlePosition = numeric.dot(handlePosition, this.gt.matrix);
      handlePosition = numeric.dot(handlePosition, this.postprocess);
      //max data vector
      // let max = this.handleMax;
      
      let sr = (d)=>{ //scaling for radii
        return utils.clamp(
          d.radius * this.transform.k, 
          8, 
          d.radiusMax || 1e9
        );
      };

      if(this.handleLines !== undefined){
        this.handleLines
        .attr('x2', (d,i)=>this.sx(0))
        .attr('x1', (d,i)=>this.sx(handlePosition[i][0]))
        .attr('y2', (d,i)=>this.sy(0))
        .attr('y1', (d,i)=>this.sy(handlePosition[i][1]))
        //make handle line ends at the boundary of the circle:
        .attr('stroke-dasharray', d=>`0 ${sr(d)} 99999`) 
        .attr('stroke-width', d=>d.handleLine ? 1.5 : 0);
        
        this.handles
        .attr('cx', (d,i)=>this.sx(handlePosition[i][0]))
        .attr('cy', (d,i)=>this.sy(handlePosition[i][1]))
        .attr('r', d=>sr(d))
        .attr('fill', d=>d['fill'] || '#fff')
        .attr('fill-opacity', d=>d['fill-opacity'] || this.styles.opacity['handle'])
        .attr('stroke', d=>d['stroke'] || '#fff')
        .attr('stroke-width', d=>d['stroke-width'] || 1.5)
        .attr('stroke-dasharray', d=>d['stroke-dasharray'] || 'none')
        .attr('stroke-opacity', d=>d['stroke-opacity'] || 0.8);

        let that = this;
        this.handleTexts
        .style('position', 'absolute')
        .style('left', function(d,i){
          let x = that.sx(handlePosition[i][0]) + d.textOffset[0]*sr(d);
          //fix svg offset
          // let svgLeft = that.svg.node().getBoundingClientRect().left;
          // x += svgLeft;
          if(d['text-anchor'] ==='middle' || d['text-anchor'] === undefined){
            x -= d3.select(this).node().getBoundingClientRect().width/2;
          }
          return `${x}px`;
        })
        .style('top', function(d,i){
          let y = that.sy(handlePosition[i][1]) + d.textOffset[1]*sr(d);
          //fix svg offset
          let svgTop = that.svg.node().getBoundingClientRect().top;
          y += svgTop;
          //fix baseline
          y -= d3.select(this).node().getBoundingClientRect().height;
          return `${y}px`;
        })
        // .style('text-anchor', d=>d['text-anchor'] || 'middle');
      }
    }
  }




  //----------- getters ---------
  //  (for interactive articles)
  get orientation(){
    return {
      preprocess: this.preprocess,
      procrustes: this.procrustes,
      grandtour: this.gt.matrix,
      grandtour_thetas: this.gt.thetas,
      grandtour_t: this.gt.t,
      postprocess: this.postprocess,
    };
  }




}//class GrandTourView end





