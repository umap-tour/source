function initShaders(gl, vShaderScript, fShaderScript) {
    function getShader(gl, shaderScript, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, shaderScript);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }
    var vertexShader = getShader(gl, vShaderScript, gl.VERTEX_SHADER),
        fragmentShader = getShader(gl, fShaderScript, gl.FRAGMENT_SHADER),
        program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        // alert("Could not initialise shaders");
        var info = gl.getProgramInfoLog(program);
        throw new Error('Could not compile WebGL program. \n\n' + info);
        return null;
    }
    return program;
}

// export function initGL(canvas_id, shaderPathPair) {
export function initGL(canvas_id, shaderScriptPair) {
  if(canvas_id[0] === '#'){
    canvas_id = canvas_id.slice(1);
  }
  let canvas = document.getElementById(canvas_id);
  let gl = canvas.getContext('webgl', {
    premultipliedAlpha: false
  });
  let program = initShaders(
    gl, 
    shaderScriptPair[0], 
    shaderScriptPair[1]
  );
  gl.program = program;
  return gl;
};

// function _init_gl_data(gl, name){
//   if(!gl.hasOwnProperty('data')){
//     gl.data = {};
//   }
//   if(!gl.data.hasOwnProperty(name)){
//     gl.data[name] = {};
//   }
// }



// function _init_attr(gl, name){
//   _init_gl_data(gl, name);
//   let loc;
//   if(!gl.data[name].hasOwnProperty('loc')){
//     loc = gl.getAttribLocation(gl.program, name);
//     gl.data[name].loc = loc;
//   }else{
//     loc = gl.data[name].loc;
//   }
//   return loc;
// }


// function _init_uniform(gl, name){
//   _init_gl_data(gl, name);
//   let loc;
//   if(!gl.data[name].hasOwnProperty('loc')){
//     loc = gl.getUniformLocation(gl.program, name);
//     gl.data[name].loc = loc;
//   }else{
//     loc = gl.data[name].loc;
//   }
//   return loc;
// }


function _init_buffer(gl, name){
  if(!gl.hasOwnProperty('buffers')){
    gl.buffers = {};
    gl.bufferDataCache = {};
  }

  let buffer;
  if(gl.buffers.hasOwnProperty(name)){
    buffer = gl.buffers[name];
  }else{
    buffer = gl.createBuffer();
    gl.buffers[name] = buffer;
  }
  return buffer;
}


export function init_buffer_with_data(gl, name, data){
  let buffer = _init_buffer(gl, name);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  let data1 = Float32Array.from(data.flat());
  gl.bufferDataCache[name] = data1;
  gl.bufferData(gl.ARRAY_BUFFER, data1, gl.STATIC_DRAW);
  return buffer;
}

// use init_attribute and update_attribute when buffer-attribute link is dynamic
export function init_attribute(gl, attrib_name, buffer_name, data){
  let buffer = init_buffer_with_data(gl, buffer_name, data);
  let loc = gl.getAttribLocation(gl.program, attrib_name);
  let dim;
  if (typeof(data[0]) == 'number'){
    dim = 1;
  }else{
    dim = data[0].length;
  }
  gl.vertexAttribPointer(loc, dim, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}


export function update_attribute(gl, attrib_name, buffer_name, dim=4){
  let buffer = gl.buffers[buffer_name];
  let loc = gl.getAttribLocation(gl.program, attrib_name);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(loc, dim, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}



// used when buffer-attribute link is static
export function update_data(gl, name, data){
  init_attribute(gl, name, name, data);
  // let loc = _init_attr(gl, name);
  // let buffer;
  // if(!gl.data[name].hasOwnProperty('buffer')){
  //   buffer = gl.createBuffer();
  //   gl.data[name].buffer = buffer;
  // }else{
  //   buffer = gl.data[name].buffer;
  // }
  
  // let data0 = Float32Array.from(data.flat());
  // gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // gl.bufferData(gl.ARRAY_BUFFER, data0, gl.STATIC_DRAW);
  // gl.data[name].data = data0;
  
  // let dim;
  // if (typeof(data[0]) == 'number'){
  //   dim = 1;
  // }else{
  //   dim = data[0].length;
  // }
  // gl.vertexAttribPointer(loc, dim, gl.FLOAT, false, 0, 0);
  // gl.enableVertexAttribArray(loc);
}


export function update_uniform_i(gl, name, value){
  let loc = gl.getUniformLocation(gl.program, name);
  gl.uniform1i(loc, value);
}

export function update_uniform(gl, name, value){
  let transpose = false;
  let loc = gl.getUniformLocation(gl.program, name);

  if (typeof(value) == 'number'){
    gl.uniform1f(loc, value);
  }else{
    if (value.length == 2){
      if (typeof(value[0]) == 'number'){
        gl.uniform2f(loc, ...value);
      }else{
        gl.uniformMatrix2fv(loc, transpose, value.flat());
      }
    }else if (value.length == 3){
      if (typeof(value[0]) == 'number'){
        gl.uniform3f(loc, ...value);
      }else{
        gl.uniformMatrix3fv(loc, transpose, value.flat());
      }
    }else if (value.length == 4){
      if (typeof(value[0]) == 'number'){
        gl.uniform4f(loc, ...value);
      }else{
        gl.uniformMatrix4fv(loc, transpose, value.flat());
      }
    }
  }
}


export function clear(gl, COLOR){
  gl.clearColor(...COLOR);
  gl.clear(gl.COLOR_BUFFER_BIT);
}