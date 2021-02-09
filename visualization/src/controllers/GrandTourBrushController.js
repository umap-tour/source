import * as d3 from 'd3';
import * as utils from '../utils/utils';
import * as numeric from 'numeric';


export default class GrandTourBrushController{

  constructor(gvView){
    this.gvs = [gvView];
  }

  add(newView){
    if(this.gvs.length < 2){//only handle a pair
      this.gvs.push(newView);
    }
  }

  on(msg, args){
    if(msg === 'brush'){
      this.onBrush(args);
    }else if(msg === 'end'){
      this.onEnd(args);
    }else{
      console.log(`[Brush Controller] Unknown brush event: ${msg}`);
    }
  }

  onBrush({gv, brushBoxWebgl}){
    // console.log(brushBoxWebgl);
    let {x0,x1,y0,y1} = brushBoxWebgl;
    gv.update({
      isBrushing: 1.0,
      brush0: [x0,x1,y0,y1],
      brush1: [x0,x1,y0,y1],
    });
  }

  onEnd({gv}){
    // console.log(isBrushed);
    let intersection = Array(gv.sampleSize).fill(1.0);
    let n = gv.sampleSize;
    for(let i=0; i<n; i++){
      for(let gv of this.gvs){
        if(gv.isBrushed !== undefined && gv.isBrushed[i] < 0.0){
          intersection[i] = -1.0;
        }else{
          continue;
        }
      }
    }
    for(let gv of this.gvs){
      gv.update({
        isBrushing: -1.0,
        isBrushed: intersection,
      });
    }
  }
}