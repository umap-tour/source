import * as d3 from 'd3';
import * as numeric from 'numeric';
import {update_uniform_i} from './gl_utils';
import * as _ from 'underscore';

import * as nd from 'nd4js';
import * as math from 'mathjs';

// let mode = 'dark';
export let mode = 'light';
export let CLEAR_COLOR, 
           TEXT_COLOR,
           BG_COLOR;

if (mode === 'dark'){
  CLEAR_COLOR = [.153, .153, .153];
  TEXT_COLOR = 'white';
  BG_COLOR = '#333';
}else{
  CLEAR_COLOR = [.95, .95, .95];
  TEXT_COLOR = 'black';
  BG_COLOR = '#ccc';
}






export let baseColorsHex = d3.schemeCategory10;
// export let baseColorsHex = d3.schemePaired;
export function hexToRgb(hex) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
}
export let baseColors = baseColorsHex.map((d)=>(hexToRgb(d)));
export let baseColorsInt = baseColorsHex.map((d)=>parseInt(d.slice(1), 16));

export let imagenet_labels_coarse = ['arachnid', 'armadillo', 'bear', 'bird', 'bug', 'butterfly', 'cat', 'coral', 'crocodile', 'crustacean', 'dinosaur', 'dog', 'echinoderms', 'ferret', 'fish', 'flower', 'frog', 'fruit', 'fungus', 'hog', 'lizard', 'marine mammals', 'marsupial', 'mollusk', 'mongoose', 'monotreme', 'person', 'plant', 'primate', 'rabbit', 'rodent', 'salamander', 'shark', 'sloth', 'snake', 'trilobite', 'turtle', 'ungulate', 'vegetable', 'wild cat', 'wild dog', 'accessory', 'aircraft', 'ball', 'boat', 'building', 'clothing', 'container', 'cooking', 'decor', 'electronics', 'fence', 'food', 'furniture', 'hat', 'instrument', 'lab equipment', 'other', 'outdoor scene', 'paper', 'sports equipment', 'technology', 'tool', 'toy', 'train', 'vehicle', 'weapon'];
export let cifar10_labels = ['airplane', 'automobile', 'bird', 'cat', 'deer', 'dog', 'frog', 'horse', 'ship', 'truck'];


export function whiteOutline(){
  return `
  <filter id="whiteOutlineEffect" width="200%" height="200%" x="-50%" y="-50%">
    <feMorphology in="SourceAlpha" result="MORPH" operator="dilate" radius="1.5" />
    <feColorMatrix in="MORPH" result="WHITENED" type="matrix" values="0 0 0 0.03 0, 0 0 0 0.03 0, 0 0 0 0.03 0, 0 0 0 1 0" />
    <feMerge>
      <feMergeNode in="WHITENED" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
  `;
}

export function isMobile(){
  // return true;
  return window.innerWidth < window.innerHeight;
}

export function sample(length, sampleSize=5000){
  let res = [];
  let increment = Math.max(1, Math.floor(length/sampleSize));
  for(let i=0; i<length; i+=increment){
    res.push(i);
  }
  return res;
}

// export function editableSVG(node, selector="text") {
//   node.addEventListener("mousemove", () => {
//     node.parentElement.classList.add("editablesvg");
//     for (const t of node.querySelectorAll(selector + ":not(.editableset)")) {
//       t.classList.add("editableset");
//       t.addEventListener("mouseenter", () => {
//         node.parentElement.setAttribute("contentEditable", true);
//         node.classList.add('editable');
//       });
//       t.addEventListener("mouseout", () => {
//         node.parentElement.setAttribute("contentEditable", null);
//         node.classList.remove('editable');
//       });
//     }
//   });
// }

export function counter(array){
  let res = {};
  for(let i=0; i<array.length; i++){
    if(array[i] in res){
      res[array[i]] += 1;
    }else{
      res[array[i]] = 1;
    }
  }
  return res;
}


export function split_matrix(matrix){
  let nrow = Math.ceil(matrix.length/4) * 4;
  let ncol = Math.ceil(matrix[0].length/4) * 4;
  let padded = math.identity(nrow, ncol)._data;
  for(let i=0; i<matrix.length; i++){
    for(let j=0; j<matrix[0].length; j++){
      padded[i][j] = matrix[i][j];
    }
  }

  let res = [];
  for(let i=0; i<Math.ceil(matrix.length/4); i++){
    for(let j=0; j<Math.ceil(matrix[0].length/4); j++){
      let submatrix = padded.slice(i*4, i*4+4).map(row=>row.slice(j*4, j*4+4));
      res.push(submatrix);
    }
  }
  return res;
}


export function zip(a){
  return a.map((_,i)=>{
    let res = [];
    for(let a=0; a<arguments.length; a++){
      res.push(arguments[a][i]);
    }
    return res;
  });
}


export function archStr2edges(archStr){
  let ops = archStr.match(/\|(\S+)~0\|\+\|(\S+)~0\|(\S+)~1\|\+\|(\S+)~0\|(\S+)~1\|(\S+)~2\|/).slice(1,7);
  return ops;
}


export function getFloorCeil(arr, value){
  let argFloor, argCeil;
  let valueIndex = arr.indexOf(value);
  if(valueIndex !== -1){
    if(valueIndex !== 0){
      return [arr[valueIndex-1],  arr[valueIndex]];
    }else{
      return [null, arr[valueIndex]];
    }
  }else{
    let diff = arr.map(e=>e-value);
    argCeil = diff.map((d,i)=>[d,i]).reduce((a,b)=>{
      if(a[0]>0 && b[0]>0){
        return a[0]<b[0]?a:b;
      }else{
        return a[0]>0?a:b;
      }
    })[1];
    argFloor = diff.map((d,i)=>[d,i]).reduce((a,b)=>{
      if(a[0]<0 && b[0]<0){
        return a[0]>b[0]?a:b;
      }else{
        return a[0]<0?a:b;
      }
    })[1];
  }
  return [arr[argFloor], arr[argCeil]];
}


export function dynamic_time_warping(seq1, seq2, distanceFunc=(a,b)=>procrustes_residual(a,b)){
  let [m,n] = [seq1.length, seq2.length]; 
  let pdist = math.zeros(m,n)._data;
  let cumulative = math.zeros(m,n)._data;
  let prev = math.zeros(m,n)._data;

  for(let i=0; i<m; i++){
    for(let j=0; j<n; j++){
      pdist[i][j] = distanceFunc(seq1[i], seq2[j]);

      if(i==0 && j==0){
        cumulative[i][j] = pdist[i][j];
        prev[i][j] = null;
      }else if(i==0 && j>0){
        cumulative[i][j] = pdist[i][j] + cumulative[i][j-1];
        prev[i][j] = [i,j-1];
      }else if(i>0 && j==0){
        cumulative[i][j] = pdist[i][j] + cumulative[i-1][j];
        prev[i][j] = [i-1, j];
      }else if(i>0 && j>0){
        let arr = [cumulative[i][j-1], cumulative[i-1][j-1], cumulative[i-1][j]];
        let argmin = arr.map((d,i)=>[d,i]).reduce((a,b)=>a[0]<=b[0]? a:b)[1];
        cumulative[i][j] = pdist[i][j] + arr[argmin];
        if(argmin == 0){
          prev[i][j] = [i, j-1];
        }else if(argmin == 1){
          prev[i][j] = [i-1, j-1];
        }else if(argmin == 2){
          prev[i][j] = [i-1, j];
        }
      }
    }
  }
  let matches = [];
  let tmp = [m-1, n-1];
  while(!(tmp[0] == 0 && tmp[1] == 0)){
    matches.unshift(tmp.slice());
    tmp = prev[tmp[0]][tmp[1]];
  }
  matches.unshift([0,0]);
  return {matches, pdist, cumulative, prev};
}


export function procrustes_residual(a,b, sampleSize=1000){
  let x1 = a.slice(0,sampleSize);
  let x2 = b.slice(0,sampleSize);

  //pre-scaling
  let norm1 = numeric.norm2(x1.flat());
  let norm2 = numeric.norm2(x2.flat());
  x1 = numeric.div(x1, norm1);
  x2 = numeric.div(x2, norm2);

  let x1t_x2 = numeric.dot(numeric.transpose(x1), x2);
  let {U,S,V} = numeric.svd(x1t_x2);

  let q = numeric.dot(U, numeric.transpose(V));
  let s = numeric.sum(S);
  let x1_new = numeric.dot(x1, q);
  // let x1_new = numeric.mul(s, numeric.dot(x1, q));
  let residual = numeric.norm2(numeric.sub(x1_new, x2).flat());
  return residual;
}

export function orthogonal_procrustes(x1, x2, sampleSize=2000){
  // find orthogonal matrix Q s.t. x1 Q ~= x2
  if(sampleSize !== undefined){
    let indices = _.sample(d3.range(x1.length), sampleSize);
    x1 = indices.map(i=>x1[i]);
    x2 = indices.map(i=>x2[i]);
  }

  //pre-scaling
  let norm1 = numeric.norm2(x1.flat());
  let norm2 = numeric.norm2(x2.flat());
  x1 = numeric.div(x1, norm1);
  x2 = numeric.div(x2, norm2);

  let x1t_x2 = numeric.dot(numeric.transpose(x1), x2);
  let {U,S,V} = numeric.svd(x1t_x2);
  let q = numeric.dot(U, numeric.transpose(V));
  return q;
}


export function procrustes_dist(x1, x2, sampleSize=25000){
  // find orthogonal matrix Q s.t. x1 Q ~= x2
  let x1s, x2s;
  if(sampleSize !== undefined){
    let indices = _.sample(d3.range(x1.length), Math.min(x1.length, sampleSize));
    x1s = indices.map(i=>x1[i]);
    x2s = indices.map(i=>x2[i]);
  }else{
    x1s = x1;
    x2s = x2;
  }

  //pre-scaling
  // let norm1 = numeric.norm2(x1.flat());
  // let norm2 = numeric.norm2(x2.flat());
  let norm1 = d3.mean(x1, d=>numeric.norm2(d));
  let norm2 = d3.mean(x2, d=>numeric.norm2(d));
  x1 = numeric.div(x1, norm1);
  x2 = numeric.div(x2, norm2);

  let x1t_x2 = numeric.dot(numeric.transpose(x1s), x2s);
  let {U,S,V} = numeric.svd(x1t_x2);
  let q = numeric.dot(U, numeric.transpose(V));

  let dist = x1.map((xi,i)=>{
    let d =  numeric.norm2(numeric.sub(numeric.dot(xi, q), x2[i]));
    return d;
  });

  return dist;
}





export function index2box(i, size=32, nrow=100, ncol=100){
  let row = Math.floor(i/ncol);
  let col = i%ncol;

  let top = row * size;
  let bottom = top + size;
  let left = col * size;
  let right = left + size;
  return {left, right, top, bottom};
}


export function normalize(v, unitlength=1) {
  if (numeric.norm2(v) <= 0) {
    return v;
  } else {
    return numeric.div(v, numeric.norm2(v)/unitlength);
  }
}


export function orthogonalize(matrix, priorityRowIndex=0) {
  // make row vectors in matrix pairwise orthogonal;
  function proj(u, v) {
    return numeric.mul(numeric.dot(u, v)/numeric.dot(u, u), u);
  }
  // Gram–Schmidt orthogonalization
  let priorityRow = matrix[priorityRowIndex];
  let firstRow = matrix[0];
  matrix[0] = priorityRow;
  matrix[priorityRowIndex] = firstRow;
  matrix[0] = normalize(matrix[0]);
  for (let i=1; i<matrix.length; i++) {
    for (let j=0; j<i; j++) {
        matrix[i] = numeric.sub(matrix[i], proj(matrix[j], matrix[i]));
    }
    matrix[i] = normalize(matrix[i]);
  }
  let tempRow = matrix[0];
  matrix[0] = matrix[priorityRowIndex];
  matrix[priorityRowIndex] = tempRow;
  return matrix;
}


export function loadTexture(gl, url, name, i) {
  function isPowerOf2(x) {
    return x & (x-1) == 0;
  }

  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  let level = 0;
  let internalFormat = gl.RGBA;
  let width = 1;
  let height = 1;
  let border = 0;
  let srcFormat = gl.RGBA;
  let srcType = gl.UNSIGNED_BYTE;
  let pixel = new Uint8Array([0, 0, 255, 255]);

  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border,
                srcFormat, srcType, pixel);

  let image = new Image();
  image.onload = function() {
    // gl.bindTexture(gl.TEXTURE_2D, texture);
    update_uniform_i(gl, name, i);
    gl.activeTexture(gl[`TEXTURE${i}`]);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }
      
  };
  image.src = url;
  return texture;
};


export function loadBin(url, handler){
  var xhr = new window.XMLHttpRequest();
  var ready = false;
  xhr.onreadystatechange = function() {

      if (xhr.readyState === 4 
          && xhr.status === 200
          && ready !== true) {

          if (xhr.responseType === "arraybuffer"){
              handler(xhr.response, url);

          }else if(xhr.mozResponseArrayBuffer !== null){
              handler(xhr.mozResponseArrayBuffer, url);

          }else if(xhr.responseText !== null){
              var data = String(xhr.responseText);
              var ary = new Array(data.length);
              for (var i = 0; i <data.length; i++) {
                  ary[i] = data.charCodeAt(i) & 0xff;
              }
              var uint8ay = new Uint8Array(ary);
              handler(uint8ay.buffer, url);
          }
          ready = true;
      }
  };

  xhr.open("GET", url, true);
  xhr.responseType="arraybuffer";
  xhr.send();
}


export function reshape(array, shape){
  let res = [];
  if (shape.length == 2) {
    let [nrow, ncol] = shape;
    for (let i=0; i<nrow; i++) {
      res.push(array.slice(i*ncol, (i+1)*ncol));
    }
  } else {
    let blocksize = shape.slice(1).reduce((a,b)=>a*b, 1);
    for (let i=0; i<shape[0]; i++) {
      res.push(
        reshape(array.slice(i*blocksize, (i+1)*blocksize), shape.slice(1))
      );
    }
  }
  return res;
}



// function area(x1, y1, x2, y2, x3, y3){
//   return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2.0);
// }
  

// function isInside(p1,p2,p3,p){
//   let [x1, y1] = p1;
//   let [x2, y2] = p2;
//   let [x3, y3] = p3;
//   let [x, y] = p;
//   let A = area(x1, y1, x2, y2, x3, y3);
//   let A1 = area(x, y, x2, y2, x3, y3);
//   let A2 = area(x1, y1, x, y, x3, y3);
//   let A3 = area(x1, y1, x2, y2, x, y);
//   if(Math.abs(A -(A1 + A2 + A3)) < 1e-4){
//     return true;
//   }else{
//     return false;
//   }
// }


// function baryCentricCoord(triangle, xy){
//   // b = x.A => x = b.dot(A.inv)
//   let A = triangle.map(d=>[d[0],d[1],1]);
//   let b = [xy[0], xy[1], 1];
//   return numeric.dot(b, numeric.inv(A));
// }
// 
// 




// ---------- matrix algebra ----------

export function interpolate_m(a0, a1){
  //interpolate two matrices in SO(p)
  let a0t_a1 = numeric.dot(numeric.transpose(a0), a1);
  let log_a0t_a1 = logm(a0t_a1);
  log_a0t_a1 = numeric.mul(0.5, numeric.sub(log_a0t_a1, numeric.transpose(log_a0t_a1)));//force it skew symmetric
  let a1t_a0 = numeric.dot(numeric.transpose(a1), a0);
  let log_a1t_a0 = logm(a1t_a0);
  log_a1t_a0 = numeric.mul(0.5, numeric.sub(log_a1t_a0, numeric.transpose(log_a1t_a0)));//force it skew symmetric
  return (t)=>{
    let a = numeric.dot(a0, expm(numeric.mul(t, log_a0t_a1)));
    let b = numeric.dot(a1, expm(numeric.mul(1-t, log_a1t_a0)));
    return numeric.add(numeric.mul(1-t, a), numeric.mul(t, b)); // hide my badly implemented, high-error logm :(
  };
}


export function expm(x){
  return math.expm(x)._data;
}


export function logm(x){
  // let {Q,T} = schur(x);
  // let log_T = logm_pade(T);
  // let res = numeric.dot(Q, log_T);
  // res = numeric.dot(res, numeric.transpose(Q));
  let res = logm_pade(x);
  return res;
}

export function clamp(num, min, max) {
  // credit: https://stackoverflow.com/questions/11409895/whats-the-most-elegant-way-to-cap-a-number-to-a-segment
  return num <= min ? min : num >= max ? max : num;
}


export function logm_pade(x){
  //pade 8
  // let a = [0, 1, 7/2, 73/15, 41/12, 743/585, 31/130, 37/1925, 761/1801800];
  // let b = [1, 4, 98/15, 28/5, 35/13, 28/39, 14/143, 4/715, 1/12870];
  //pade 10
  let a = [0, 1, 9/2, 484/57, 497/57, 34167/6460, 14917/7752, 2761/6783, 831/18088, 4861/2116296, 671/21162960];
  let b = [1, 5, 405/38, 240/19, 2940/323, 1323/323, 735/646, 60/323, 135/8398, 5/8398, 1/184756];
  
  let eye = math.identity(x.length)._data;
  let zero = math.zeros([x.length, x.length]);
  // let err = numeric.norm2(numeric.sub(x, eye));
  x = numeric.sub(x, eye);
  let xs = d3.range(a.length).map(i=>{
    if(i==0){
      return math.identity(x.length)._data;
    }else if(i==1){
      return x;
    }else{
      return math.pow(x, i);
    }
  });
  let num = xs
  .map((xi, i)=>numeric.mul(xi, a[i]))
  .reduce((a,b)=>numeric.add(a, b), zero);
  let den = xs
  .map((xi, i)=>numeric.mul(xi, b[i]))
  .reduce((a,b)=>numeric.add(a, b), zero);
  let den_inv = numeric.inv(den); //TODO: use some 'np.linalg.solve' 
  let res = numeric.dot(num, den_inv);
  return res;
}



export function schur(a){
  let [Q,T] = nd.la.schur_decomp(a);
  Q = math.reshape(Array.from(Q.data), Array.from(Q.shape));
  T = math.reshape(Array.from(T.data), Array.from(T.shape));
  return {Q, T};
}


