import "./css/style-single.css";

import * as d3 from 'd3';
import * as math from 'mathjs';

import * as utils from './utils/utils';
// import GrandTourView from './views/GrandTourView';
import GrandTourInTheShaderView from './views/GrandTourInTheShaderView';
import UMAPView from './views/UMAPView';
import LayersView from './views/LayersView';

window.d3 = d3;
window.utils = utils;
window.math = math;



export function main(metaUrl, config={}){

  let root = d3.select('#root');
  let canvas = root.select('#grandtour-canvas');
  let width = canvas.node().getBoundingClientRect().width;
  let height = canvas.node().getBoundingClientRect().height;
  canvas
  .attr('width', width * devicePixelRatio)
  .attr('height', height * devicePixelRatio)
  // .style('width', `${width}px`)
  // .style('height', `${height}px`);

  // let metaUrl = 'data/meta-gdas.json';
  // let metaUrl = 'data/meta.json';
  // let metaUrl = 'data/meta-gdas-prevEpochInit.json';
  // let metaUrl = 'data/meta-darts20.json';
  // 
  
  d3.json(metaUrl).then((meta)=>{
    console.log(meta);
    let keys = Object.keys(meta.epoch_arch_to_dir)
    .map( k=>k.split(',').map(d=>parseInt(d)) );
    let [epochIndex, archIndex] = keys[keys.length-1];
    let layerIndex = 0;
    window.keys = keys;

    let gv = new GrandTourInTheShaderView(
      canvas, 
      meta.data_shape, 
      meta.epoch_arch_to_dir, 
      meta.image_urls, 
      meta.attribute_url,
      meta.attributes,
      epochIndex, archIndex, layerIndex
    );

    //umap view:
    let embeddingUrl = 'data/all-arch-umap-presoftmax-2.json';
    d3.json(embeddingUrl).then((umapData)=>{
      // let aau = new UMAPView(root.select('#all-arch-umap'), umapData, keys, epochIndex, archIndex);
      let aau = undefined;
      let lv = undefined;
      window.aau = aau;

      //layers view
      let archs = umapData.archs;
      let dir0 = meta.epoch_arch_to_dir[`${epochIndex},${archIndex}`];
      d3.json('data/' + dir0 + '/schema.json').then(schema=>{
        let archTemplate = schema.layers.map((l,i)=>{
          return {
            id: l.id,
            index: i
          };
        });
        // let lv = new LayersView(root.select('#layers'), 
        //   archs, archTemplate, 
        //   keys, meta.epoch_arch_to_dir,
        //   epochIndex, archIndex, layerIndex
        // );
        // window.lv = lv;

        //grand tour view
        


        // //preload all layers if there is only one architecture and one epoch
        // if(Object.keys(meta.epoch_arch_to_dir).length <= 1){
        //   let keys = Object.keys(meta.epoch_arch_to_dir);
        //   for(let key of keys){
        //     let [epoch, arch] = key.split(',');
        //     epoch = +epoch;
        //     arch = +arch;
        //     for (let i=0; i<schema.layers.length; i++){
        //       console.log(`preloading: [${epoch},${arch},${i}]`);
        //       gv.load(epoch, arch, i, 0.001, false);
        //     }
        //   }
        // }

        window.gv = gv;
        if(lv !== undefined){
          gv.lv = lv; 
          lv.gv = gv;
        }
        if(aau !== undefined){
          gv.aau = aau; 
          aau.lv = lv;
          aau.gv = gv;
        }


        // // controls
        // if(metaUrl.includes('gdas')
        // ||metaUrl.includes('darts')){

        //   // TODO: make it faster by loading layers independently
        //   function preload(layerIndex){
        //     console.log('preloading layer', layerIndex);
        //     //assuming for each epoch (keys[i][0]) there is only one arch (keys[i][1])
        //     keys.forEach(d=>{
        //       // gv.setEpochArchLayer(d[0], d[1], layerIndex, 0.01);
        //       let display = d[0] == epochIndex;
        //       let duration = 0.0001;
        //       gv.load(d[0], d[1], layerIndex, duration, display);
        //     });
        //   }
        //   preload(layerIndex);
        //   // lv.cells.nodes().forEach((c,i)=>{
        //   //   c.addEventListener('click', ()=>{
        //   //     preload(i);
        //   //   })
        //   // });
        //   let epochs = Array.from( new Set(keys.map(d=>d[0]))).sort((a,b)=>a-b);
        //   let epochStepList = d3.select('#epochStepList');
        //   epochStepList
        //   .selectAll('option')
        //   .data(epochs)
        //   .enter()
        //   .append('option')
        //   .text(d=>d);

        //   let epochSlider = d3.select('#epochSlider');
        //   epochSlider
        //   .attr('min', epochs[0])
        //   .attr('max', epochs[epochs.length-1])
        //   .attr('value', epochIndex)
        //   //debug
        //   // .attr('min', 105) 
        //   // .attr('max', 115)
        //   // .attr('value', 105)
        //   .on('input', (value)=>{
        //     value = value || +epochSlider.node().value;

        //     // find closest floor and ceil available
        //     let [epochIndexFloor, epochIndexCeil] = utils.getFloorCeil(epochs, value);
        //     let progress;
        //     if(epochIndexFloor === null){
        //       epochIndexFloor = epochIndexCeil;
        //       progress = 0.0;
        //     }else{
        //       progress = (value - epochIndexFloor) / (epochIndexCeil-epochIndexFloor);
        //     }

        //     let archIndexFloor = keys.filter(d=>d[0]==epochIndexFloor)[0][1];
        //     let archIndexCeil = keys.filter(d=>d[0]==epochIndexCeil)[0][1];

        //     let layerIndexFloor = gv.layerIndex;
        //     let layerIndexCeil = gv.layerIndex;

        //     gv.setFloatEpochArchLayer(
        //       epochIndexFloor, epochIndexCeil,
        //       archIndexFloor, archIndexCeil,
        //       layerIndexFloor, layerIndexCeil,
        //       progress
        //     );

        //     aau.setEpoch(epochIndexFloor);
        //     //update layers view
        //     lv.setEpoch(epochIndexFloor);
        //     lv.setArch(archIndexFloor);

        //   })
        //   .on('change', (value)=>{
        //     value = value || +epochSlider.node().value;

        //     let [epochIndexFloor, epochIndexCeil] = utils.getFloorCeil(epochs, value);
        //     if(epochIndexFloor === null){
        //       epochIndexFloor = epochIndexCeil;
        //     }

        //     let archIndexFloor = keys.filter(d=>d[0]==epochIndexFloor)[0][1];
        //     let archIndexCeil = keys.filter(d=>d[0]==epochIndexCeil)[0][1];
        //     let progress = value-epochIndexFloor < epochIndexCeil-value ? 0.0:1.0;
        //     let layerIndexFloor = gv.layerIndex;
        //     let layerIndexCeil = gv.layerIndex;
        //     gv.setFloatEpochArchLayer(
        //       epochIndexFloor, epochIndexCeil,
        //       archIndexFloor, archIndexCeil,
        //       layerIndexFloor, layerIndexCeil,
        //       progress
        //     );
            

        //     epochIndex = progress > 0.5 ? epochIndexCeil:epochIndexFloor;
        //     archIndex = keys.filter(d=>d[0]==epochIndex)[0][1];
        //     gv.epochIndex = epochIndex;
        //     gv.archIndex = archIndex;

        //     //update umap view, 
        //     aau.setEpoch(epochIndex);
        //     //update layers view
        //     lv.setEpoch(epochIndex);
        //     lv.setArch(archIndex);
        //     epochSlider.node().value = epochIndex;

        //   });//end epochSlider def

        // }else{
        //   //tinynet vis
        //   d3.select('#epochSlider').remove();
        //   d3.select('#epochLabel').remove();
        // }
      });//end of d3.json(xxx'schema.json')
    });//end of d3.json(embeddingUrl)
  });


  //controls
  // let title = root.select('#title');
  // let layerSlider = null;//root.select('#layerSlider');
  
  // window.setLayer = (layerIndex)=>{
  //   gv.setLayer(layerIndex);
  // };
  // window.animateLayer = function(layer, duration=1000){
  //   gv.animateLayer(layer);
  // };

  // if(layerSlider){
  //   layerSlider
  //   .on('input', function(value){
  //     let layerIndex = value || +layerSlider.node().value;    
  //     setLayer(layerIndex);
  //     gv.updateHighlight();
  //   })
  //   .on('change', (value)=>{
  //     //snap to x.5/integer numbers
  //     // let layerIndex = Math.round(+layerSlider.node().value * 2) / 2;   
  //     //snap to integers
  //     let layerIndex = Math.round(+layerSlider.node().value);    
  //     setLayer(layerIndex);
  //     layerSlider.node().value = layerIndex;
  //     gv.layerIndex = layerIndex;
  //   });
  //   gv.layerSlider = layerSlider;
  //   // let layerSliderTicks = root.select('#steplist')
  //   // .selectAll('option')
  //   // .data(d3.range(23))
  //   // .enter()
  //   // .append('option')
  //   // .text(d=>d);
  // }
  
  

  // let isLayerAutoPlay = false;
  // let layerAnimId;
  // let playButton = root.select('#play')
  // .on('click', ()=>{
  //   isLayerAutoPlay = !isLayerAutoPlay;
  //   if(isLayerAutoPlay){
  //     playButton.attr('class', 'fas fa-pause-circle');

  //     let t0 = performance.now();
  //     let tick = ()=>{
  //       layerAnimId = requestAnimationFrame((t)=>{
  //         let dt = t-t0;
  //         let layerIndex = gv.layerIndex + dt/1000;
  //         if (layerIndex > 22){//TODO debug
  //           layerIndex = 0;
  //           gv.layerIndex = 0;
  //         }
  //         layerSlider.on('input')(layerIndex);
  //         layerSlider.node().value = layerIndex;
  //         tick();
  //       });
  //     };
  //     tick();

  //   }else{
  //     playButton.attr('class', 'fas fa-play-circle');
  //     cancelAnimationFrame(layerAnimId);
  //   }
  // });
};