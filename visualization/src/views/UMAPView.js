import * as d3 from 'd3';
import * as utils from '../utils/utils';
import * as numeric from 'numeric';

d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};


export default class UMAPView{
  constructor(svg, data, keys, epochIndex, archIndex){
    this.svg = svg;
    this.keys = keys;
    this.archs = new Set(keys.map(d=>d[1]));
    this.dataObj = data;

    this.init(epochIndex, archIndex);
  }

  // loadAndDraw(metaUrl){
  //   d3.json(metaUrl).then((meta)=>{
  //     this.meta = meta;
  //     this.keys = Object.keys(meta.epoch_arch_to_dir)
  //     .map(k=>{
  //       let [e, a] = k.split(',');
  //       e = parseInt(e);
  //       a = parseInt(a);
  //       return [e,a];
  //     });
  //     let [epochIndex, archIndex] = this.keys[0];
  //   });
  // }

  init(epochIndex, archIndex){
    this.setEpoch(epochIndex);
    this.highlight(archIndex);
  }


  setEpoch(epochIndex){
    //TODO make it faster
    if(this.epochIndex === epochIndex){
      return;
    }else{
      this.clickable = new Set(
        this.keys
        .filter(d=>{
          return d[0]==epochIndex;
        })
        .map(d=>{
          return d[1];
        })
      );
      this.draw(this.clickable);
      this.epochIndex = epochIndex;
    }
  }


  updateScales(xy, labels){
    let margin = 30;
    let marginLeft = margin;
    let marginRight = margin;
    let marginTop = margin;
    let marginBottom = margin;

    let width = this.svg.node().getBoundingClientRect().width;
    let height = this.svg.node().getBoundingClientRect().height;

    this.xExtent = d3.extent(xy, d=>d[0]);
    this.yExtent = d3.extent(xy, d=>d[1]);

    this.sx = d3.scaleLinear()
    .domain(this.xExtent)
    .range([marginLeft, width-marginRight]);
    this.sy = d3.scaleLinear()
    .domain(this.yExtent)
    .range([height-marginBottom, marginTop]);

    let cExtent = d3.extent(labels);
    this.sc = d3.scaleSequential()
    .domain(cExtent)
    .interpolator(d3.interpolateViridis);
  }

  draw(clickable){
    //TODO draw more efficiently with webgl
    let xy = this.dataObj.embeddings;
    let accuracies = this.dataObj.accuracies;
    let data = d3.range(xy.length).map(i=>({
      i: i,
      x: xy[i][0],
      y: xy[i][1],
      accuracy: accuracies[i],
    }));

    //only show archs that is available
    //TODO draw more efficiently with webgl
    data = data.filter(d=>{
      return this.archs.has(d.i);
    });

    if(this.sx === undefined || 
      this.sy === undefined 
      || this.sc === undefined){
      this.updateScales(xy, accuracies);
    }

    this.svg.selectAll('.point')
    .data(data, function(d) { return d.i; })
    .enter()
    .append('circle')
    .attr('class', 'point');
    this.points = this.svg.selectAll('.point');


    this.points
    .attr('cx', d=>this.sx(d.x))
    .attr('cy', d=>this.sy(d.y))
    .attr('r', (d,i)=>{
      if(clickable.has(d.i)){
        return 6;
      }else{
        return 2;
      }
    })
    .attr('fill', (d,i)=>{
      if(clickable.has(d.i)){
        return this.sc(d.accuracy);
      }else{
        return d3.color(this.sc(d.accuracy)).darker(1);
      }
    })
    .attr('stroke-width', 0.5)
    .attr('stroke', d=>d3.color(this.sc(d.accuracy)).darker(1))
    .attr('opacity', (d,i)=>{
      if(clickable.has(d.i)){
        return 1.0;
      }else{
        return 0.7;
      }
    })
    .attr('display', (d,i)=>{
      return '';
      // if(clickable.has(d.i)){
      //   return '';
      // }else{
      //   if(Math.random() < 0.02){
      //     return '';
      //   }else{
      //     return 'none';
      //   }
      // }
    });


    this.points
    .filter((d, i)=>{
      return clickable.has(d.i);
    })
    .on('click', (d)=>{
      console.log('clicked arch', d.i);
      if(this.gv !== undefined){
        this.gv.onUmapClick(d.i);
      }
      if(this.lv !== undefined){
        //TODO make this faster?
        this.lv.onUmapClick(d.i);
      }

      this.highlight(d.i);
    })
    .moveToFront();
  }

  highlight(i){
    this.points
    .attr('stroke', (d)=>{
      if (d.i==i){
        return 'white';
      }else{
        return d3.color(this.sc(d.accuracy)).darker(1);
      }
    })
    .attr('stroke-width', (d)=>{
      if (d.i == i){
        return 2.5;
      }else{
        return 0.5;
      }
    });
  }

}