import "./css/style-compare.css";

import * as d3 from 'd3';
import * as math from 'mathjs';

import * as utils from './utils/utils';
import GrandTourInTheShaderView from './views/GrandTourInTheShaderView';
import UMAPView from './views/UMAPView';
import LayersView from './views/LayersView';

window.d3 = d3;
window.utils = utils;
window.math = math;




export function main(metaUrls, simUrl){
  let root = d3.select('#root');
  let gvs = [];
  for(let panelIndex=0; panelIndex<2; panelIndex++){
    let canvas = root.select(`#grandtour-canvas-${panelIndex+1}`);
    let width = canvas.node().getBoundingClientRect().width;
    let height = canvas.node().getBoundingClientRect().height;
    canvas
    .attr('width', width * devicePixelRatio)
    .attr('height', height * devicePixelRatio)

    d3.json(metaUrls[panelIndex]).then((meta)=>{
      let keys = Object.keys(meta.epoch_arch_to_dir)
      .map(k=>{
        let [e, a] = k.split(',');
        e = parseInt(e);
        a = parseInt(a);
        return [e,a];
      });
      //init
      let [epochIndex, archIndex] = keys[keys.length-1];
      let layerIndex = 0;
      window.keys = keys;

      //umap view:
      let embeddingUrl = 'data/all-arch-umap-presoftmax-2.json';
      d3.json(embeddingUrl).then((umapData)=>{
        // let aau = new UMAPView(root.select('#all-arch-umap'), umapData, keys, epochIndex, archIndex);
        // window.aau = aau;

        //layers view
        let archs = umapData.archs;
        let dir0 = meta.epoch_arch_to_dir[`${keys[0][0]},${keys[0][1]}`];
        d3.json('data/' + dir0 + '/schema.json').then(schema=>{
        //   let archTemplate = schema.layers.map((l,i)=>{
        //     return {
        //       id: l.id,
        //       index: i
        //     };
        //   });

        //   let screen_size = Math.min(window.innerWidth/2, window.innerHeight);
        //   let edge_stroke_width = 3 / Math.sqrt(969) * Math.sqrt(screen_size); // about 3 on a 1485 x 969px screen
        //   let node_stroke_width = 1.5 / Math.sqrt(969) * Math.sqrt(screen_size);
        //   let node_radius = 4 / Math.sqrt(969) * Math.sqrt(screen_size);
        //   let margin = 5;
        //   let style = {
        //     edge_stroke_width, 
        //     node_stroke_width, 
        //     node_radius,
        //     margin,
        //   };
          // let lv = new LayersView(root.select(`#layers-${panelIndex+1}`), 
          //   archs, archTemplate, 
          //   keys, meta.epoch_arch_to_dir,
          //   epochIndex, archIndex, layerIndex,
          //   style
          // );
          // window[`lv${panelIndex+1}`] = lv;




          //grand tour view
          //  constructor(canvas, ndim, epoch_arch_to_dir, imageUrls, epochIndex, archIndex, layerIndex){

          let styles = {
            layerPosition: panelIndex==0?'left':'right',
            defaultUI: panelIndex==0 ? 
            ['handle', 'layer', 'zoom', 'legend', 'attribute', 'fps']
            :['help', 'handle', 'layer', 'resetZoom', 'zoom'],
          };
          let gv = new GrandTourInTheShaderView(
            // canvas, 
            // meta.data_shape, 
            // meta.epoch_arch_to_dir, 
            // meta.image_urls, 
            // meta.label_text,
            // epochIndex, archIndex, layerIndex,
            // styles
            canvas, 
            meta.data_shape, 
            meta.epoch_arch_to_dir, 
            meta.image_urls, 
            meta.attribute_url,
            meta.attributes,
            epochIndex, archIndex, layerIndex,
            styles
          );
          window[`gv${panelIndex+1}`] = gv;
          // gv.lv = lv; 
          // gv.aau = aau; 
          // aau.lv = lv;
          // aau.gv = gv;
          // lv.gv = gv;
          // if(i==1){
          //   window.gv2.alignWith(window.gv1);
          // }

          // controls
          
          function preload(layerIndex){
            console.log('preloading layer', layerIndex);
            //assuming for each epoch (keys[i][0]) there is only one arch (keys[i][1])
            keys.forEach(d=>{
              // gv.setEpochArchLayer(d[0], d[1], layerIndex, 0.01);
              let display = d[0] == epochIndex;
              let duration = 0.0001;
              gv.load(d[0], d[1], layerIndex, duration, display);
            });
          }
          preload(layerIndex);
          // lv.cells.nodes().forEach((c,i)=>{
          //   c.addEventListener('click', ()=>{
          //     preload(i);
          //   })
          // });

          let epochs = Array.from( new Set(keys.map(d=>d[0]))).sort((a,b)=>a-b);
          let epochStepList = d3.select('#epochStepList');
          epochStepList
          .selectAll('option')
          .data(epochs)
          .enter()
          .append('option')
          .text(d=>d);

          let epochSlider = d3.select(`#epoch-slider-${panelIndex+1}`);
          if(Object.keys(meta.epoch_arch_to_dir).length == 1){
            epochSlider.remove();
          }else{
            epochSlider
            .attr('min', epochs[0])
            .attr('max', epochs[epochs.length-1])
            .attr('value', epochIndex)
            .on('input', (value)=>{
              value = value || +epochSlider.node().value;
              let [epochIndexFloor, epochIndexCeil] = utils.getFloorCeil(epochs, value);
              let progress;
              if(epochIndexFloor === null){
                epochIndexFloor = epochIndexCeil;
                progress = 0.0;
              }else{
                progress = (value - epochIndexFloor) / (epochIndexCeil-epochIndexFloor);
              }

              let archIndexFloor = keys.filter(d=>d[0]==epochIndexFloor)[0][1];
              let archIndexCeil = keys.filter(d=>d[0]==epochIndexCeil)[0][1];

              let layerIndexFloor = gv.layerIndex;
              let layerIndexCeil = gv.layerIndex;

              gv.setFloatEpochArchLayer(
                epochIndexFloor, epochIndexCeil,
                archIndexFloor, archIndexCeil,
                layerIndexFloor, layerIndexCeil,
                progress
              );

              // aau.setEpoch(epochIndexFloor);
              //update layers view
              lv.setEpoch(epochIndexFloor);
              lv.setArch(archIndexFloor);

            })
            .on('change', (value)=>{
              value = value || +epochSlider.node().value;
              // find closest epoch available
              // let diff = epochs.map(e=>Math.abs(e-value));
              // let argmin = diff.map((d,i)=>[d,i]).reduce((a,b)=>a[0]<b[0]? a:b)[1];
              // epochIndex = epochs[argmin]; 
              // let archIndex = keys.filter(d=>d[0]==epochIndex)[0][1];
              // 
              let [epochIndexFloor, epochIndexCeil] = utils.getFloorCeil(epochs, value);
              if(epochIndexFloor === null){
                epochIndexFloor = epochIndexCeil;
              }

              let archIndexFloor = keys.filter(d=>d[0]==epochIndexFloor)[0][1];
              let archIndexCeil = keys.filter(d=>d[0]==epochIndexCeil)[0][1];
              let progress = value-epochIndexFloor < epochIndexCeil-value ? 0.0:1.0;
              let layerIndexFloor = gv.layerIndex;
              let layerIndexCeil = gv.layerIndex;
              gv.setFloatEpochArchLayer(
                epochIndexFloor, epochIndexCeil,
                archIndexFloor, archIndexCeil,
                layerIndexFloor, layerIndexCeil,
                progress
              );
              gv.anotherView = 'pending';


              epochIndex = progress > 0.5 ? epochIndexCeil:epochIndexFloor;
              archIndex = keys.filter(d=>d[0]==epochIndex)[0][1];
              gv.epochIndex = epochIndex;
              gv.archIndex = archIndex;
              //update umap view, 
              // aau.setEpoch(epochIndex);
              //update layers view
              lv.setEpoch(epochIndex);
              lv.setArch(archIndex);
              epochSlider.node().value = epochIndex;

              // initDtwMatrix(window.gv1, window.gv2);

            });//end epochSlider def
          }

        });//end of d3.json(xxx'schema.json')
      });//end of d3.json(embeddingUrl)
    });
  }//end for loop


  let hasSet = false;
  let intervalId = setInterval(()=>{
    if(window.gv1 !== undefined 
    && window.gv2 !== undefined 
    && hasSet == false){

      //set up alignment between two views
      initAxisAlignment(window.gv1, window.gv2);

      //set up a common layer slider
      // initDtwSlider(window.gv1, window.gv2);
      // 
      // TODO fix me
      // initDtwMatrix(window.gv1, window.gv2);
      // 
      // 
      
      //Similarity matrix
      if(simUrl !== undefined){
        let shape = simUrl.split('-').reverse()[0].split('.')[0].split('x');
        shape = shape.map(d=>+d);
        fetch(simUrl)
        .then((response)=>response.arrayBuffer())
        .then((data)=>{
          let d = Array.from(new Float32Array(data));
          d = utils.reshape(d, shape);
          initSimMatrix(d, window.gv1, window.gv2);
        });
      }
      

      hasSet = true;
      clearInterval(intervalId);
    }
  }, 100);
};


function initSimMatrix(sim, gv1, gv2){
  let [nrows, ncols] = [sim.length, sim[0].length];
  let size = 5;

  let simData = [];
  sim.forEach((row, i)=>{
    row.forEach((value, j)=>{
      simData.push({
        i, j, value
      });
    });
  });

  let [w, h] = [ncols*size,nrows*size];
  let svg = d3.select('#root')
  .append('svg')
  .attr('id', 'simMatrix')
  .attr('width', w)
  .attr('height', h)
  .style('position', 'absolute')
  .style('left', window.innerWidth/2-w/2)
  .style('top', window.innerHeight-h - 10);
  

  let sx = d3.scaleLinear([0, ncols],[0, w]);
  let sy = d3.scaleLinear([0, nrows],[0, h]);
  let sc = d3.interpolateViridis;

  let l1 = gv1.layerIndex;
  let l2 = gv2.layerIndex;
  let simRect = svg.selectAll('.simRect')
  .data(simData)
  .enter()
  .append('rect')
  .attr('class', 'simRect')
  .attr('x', d=>sx(d.j))
  .attr('y', d=>sy(d.i))
  .attr('width', size)
  .attr('height', size)
  .attr('fill', d=>sc(d.value))
  .on('mouseover', d=>{

    simRect.attr('opacity', e=>(e.i==d.i || e.j ==d.j) ? 1.0 : 0.6);
    gv1.layerControls.on('mouseover')(null, d.i);
    gv2.layerControls.on('mouseover')(null, d.j);
    if (l1 === undefined){
      l1 = gv1.layerIndex;
      l2 = gv2.layerIndex;
    }
    // gv1.setLayer(d.i, 1);
    // gv2.setLayer(d.j, 1);
  })
  .on('click', (d)=>{
    console.log(d);
    l1 = d.i;
    l2 = d.j;
    gv1.setLayer(d.i);
    gv2.setLayer(d.j);
    svg.on('mouseout')();

  });

  svg.on('mouseout', ()=>{
    gv1.layerControls.on('mouseout')(l1);
    gv2.layerControls.on('mouseout')(l2);
    simRect
    .attr('opacity', 1.0)
    .attr('stroke-width', d=>(d.i==l1 && d.j==l2)?2:0)
    .attr('stroke', '#333');

    // gv1.setLayer(l1);
    // gv2.setLayer(l2);
  });

  let display = true;
  window.addEventListener('keydown', (event)=>{
    let key = event.key.toLowerCase();
    if (key === 's'){
      display = !display;
      svg.attr('display', display?'':'none');
    }
  });
}


function initAxisAlignment(gv1, gv2){
  gv1.anotherView = gv2;
  gv2.anotherView = gv1;
  gv2.gt = gv1.gt;
  gv1.alignmentMode == 'leader';
  gv2.alignmentMode == 'follower';
  //use a shared brush controller
  gv2.brushController = gv1.brushController;
  gv2.brushController.add(gv2);
}


let dtwCache = {};
window.dtwCache = dtwCache;
function initDtwMatrix(gv1, gv2){
  // TODO fix me
  return; 
  let [m,n] = [23,23];
  
  for(let i=0; i<m; i++){
    if(gv1.dataObj[gv1.epochIndex] === undefined
    || gv1.dataObj[gv1.epochIndex][gv1.archIndex] === undefined
    || gv1.dataObj[gv1.epochIndex][gv1.archIndex][i] === undefined){
      gv1.load(gv1.epochIndex, gv1.archIndex, i, 0.001, false, ()=>{initDtwMatrix(gv1, gv2)});
      console.log(`loading...`);
      return;
    }
  }
  for(let i=0; i<n; i++){
    if(gv2.dataObj[gv2.epochIndex] === undefined
    || gv2.dataObj[gv2.epochIndex][gv2.archIndex] === undefined
    || gv2.dataObj[gv2.epochIndex][gv2.archIndex][i] === undefined){
      gv2.load(gv2.epochIndex, gv2.archIndex, i, 0.001, false, ()=>{initDtwMatrix(gv1, gv2)});
      console.log(`loading...`);
      return;
    }
  }
  //compute dtw
  let cacheKey = [gv1.epochIndex, gv1.archIndex, gv2.epochIndex, gv2.archIndex].join(',');
  let dtw = undefined;
  if(cacheKey in dtwCache){
    dtw = dtwCache[cacheKey];
  }else{
    let seq1 = d3.range(m).map(i=>gv1.dataObj[gv1.epochIndex][gv1.archIndex][i]);
    let seq2 = d3.range(n).map(i=>gv2.dataObj[gv2.epochIndex][gv2.archIndex][i]);
    dtw = utils.dynamic_time_warping(seq1, seq2);
    dtwCache[cacheKey] = dtw;
  }
  console.log(dtw);
  
  let matches = new Set(dtw.matches.map(d=>d.join(',')));

  let data = [];
  for (let i=0; i<m; i++){
    for (let j=0; j<n; j++){
      data.push({
        i, 
        j,
        dist: dtw.pdist[i][j],
        cumulative: dtw.cumulative[i][j],
        isMatch: matches.has(`${i},${j}`),
      });
    }
  }

  let svg = d3.select('#dtw-layer-matrix');
  let width = svg.node().getBoundingClientRect().width;
  let height = svg.node().getBoundingClientRect().height;
  let boxSize = Math.min(width, height) / Math.max(m,n);
  let sx = d3.scaleLinear()
  .domain([0,n])
  .range([0+(width-height),height+(width-height)]);
  let sy = d3.scaleLinear()
  .domain([0,m])
  .range([0,height]);
  let sc = d3.scaleSequential()
  // .domain(d3.extent(dtw.cumulative.flat()))
  .domain(d3.extent(dtw.pdist.flat()))
  .interpolator(d3.interpolateViridis);

  svg.selectAll('.box')
  .data(data)
  .exit()
  .remove();

  svg.selectAll('.box')
  .data(data)
  .enter()
  .append('rect')
  .attr('class', 'box');

  svg.selectAll('.box')
  .data(data)
  .attr('y', d=>sy(d.i))
  .attr('x', d=>sx(d.j))
  .attr('width', boxSize)
  .attr('height', boxSize)
  .attr('fill', d=>sc(d.dist))
  // .attr('fill', d=>sc(d.cumulative))
  .attr('stroke-width', d=>d.isMatch?1.0:0.0)
  .attr('stroke', d=>d.isMatch?'white':'none')
  .on('click', (d)=>{
    console.log(d);
    gv1.setEpochArchLayer(gv1.epochIndex, gv1.archIndex, d.i);
    gv2.setEpochArchLayer(gv2.epochIndex, gv2.archIndex, d.j);
    gv1.lv.setLayer(d.i);
    gv2.lv.setLayer(d.j);
  });
}





// function initDtwSlider(gv1, gv2){
//   let commonLayerSlider = d3.select('#common-layer-slider');
//   let dtwCache = {};
//   function onInput(value){
//     for(let i=0; i<23; i++){
//       if(gv1.dataObj[gv1.epochIndex][gv1.archIndex][i] === undefined){
//         gv1.load(gv1.epochIndex, gv1.archIndex, i, 0.001, false, onInput);
//         console.log(`loading...`);
//         return;
//       }
//       if(gv2.dataObj[gv2.epochIndex][gv2.archIndex][i] === undefined){
//         gv2.load(gv2.epochIndex, gv2.archIndex, i, 0.001, false, onInput);
//         console.log(`loading...`);
//         return;
//       }
//     }
//     console.log(`loading done `);
//     let cacheKey = [gv1.epochIndex, gv1.archIndex, gv2.epochIndex, gv2.archIndex].join(',');
//     let dtw = undefined;
//     if(cacheKey in dtwCache){
//       dtw = dtwCache[cacheKey];
//     }else{
//       let seq1 = d3.range(23).map(i=>gv1.dataObj[gv1.epochIndex][gv1.archIndex][i]);
//       let seq2 = d3.range(23).map(i=>gv2.dataObj[gv2.epochIndex][gv2.archIndex][i]);
//       dtw = utils.dynamic_time_warping(seq1, seq2);
//       dtwCache[cacheKey] = dtw;
//     }

//     commonLayerSlider
//     .attr('min', 0)
//     .attr('max', dtw.matches.length-1);
//     value = value || +commonLayerSlider.node().value;

//     console.log('value: ', value);
//     console.log('match: ', dtw.matches[value]);

//     let [layer1, layer2] = dtw.matches[value];
//     gv1.setEpochArchLayer(gv1.epochIndex, gv1.archIndex, layer1);
//     gv2.setEpochArchLayer(gv2.epochIndex, gv2.archIndex, layer2);
//     gv1.lv.setLayer(layer1);
//     gv2.lv.setLayer(layer2);
    
//   }

//   commonLayerSlider.on('input', onInput);
// }