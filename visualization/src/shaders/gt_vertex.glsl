// attribute vec4 a_position;
attribute vec4 a_color;
varying vec4 v_color;

attribute float a_label;
varying float v_label;

uniform float min_size; // for depth cueing
uniform float point_size;
uniform float zoom_factor;

attribute float a_mode; // 0.0=point, 1.0=image
varying float v_mode;

uniform float xDataMin;
uniform float xDataMax;
uniform float yDataMin;
uniform float yDataMax;
uniform float zDataMin;
uniform float zDataMax;


attribute vec4 position_0;
attribute vec4 position_1;
attribute vec4 position_2;
attribute vec4 position_3;

attribute vec4 position_prev_0;
attribute vec4 position_prev_1;
attribute vec4 position_prev_2;
attribute vec4 position_prev_3;

uniform float t;
uniform mat4 preprocess[16];
uniform mat4 procrustes_prev[16];
uniform mat4 procrustes[16];
uniform mat4 gt_matrix[16];
uniform mat4 postprocess[4];

uniform float is_brushing;
uniform vec4 brush_0;
uniform vec4 brush_1;
attribute float is_brushed;
varying float v_selected;


attribute float a_index;
varying float v_index;


float fog_near = -0.1;
float fog_far = 0.8;
vec4 fog_color = vec4(0.25, 0.25, 0.25, 1.0);

void main() {

  vec4 p0 = position_0;
  vec4 p1 = position_1;
  vec4 p2 = position_2;
  vec4 p3 = position_3;
  vec4 q0 = position_prev_0;
  vec4 q1 = position_prev_1;
  vec4 q2 = position_prev_2;
  vec4 q3 = position_prev_3;

  vec4 pp0 = preprocess[0]*p0 + preprocess[4]*p1 + preprocess[8]*p2 + preprocess[12]*p3;
  vec4 pp1 = preprocess[1]*p0 + preprocess[5]*p1 + preprocess[9]*p2 + preprocess[13]*p3;
  vec4 pp2 = preprocess[2]*p0 + preprocess[6]*p1 + preprocess[10]*p2 + preprocess[14]*p3;
  vec4 pp3 = preprocess[3]*p0 + preprocess[7]*p1 + preprocess[11]*p2 + preprocess[15]*p3;
  vec4 ppp0 = procrustes[0]*pp0 + procrustes[4]*pp1 + procrustes[8]*pp2 + procrustes[12]*pp3;
  vec4 ppp1 = procrustes[1]*pp0 + procrustes[5]*pp1 + procrustes[9]*pp2 + procrustes[13]*pp3;
  vec4 ppp2 = procrustes[2]*pp0 + procrustes[6]*pp1 + procrustes[10]*pp2 + procrustes[14]*pp3;
  vec4 ppp3 = procrustes[3]*pp0 + procrustes[7]*pp1 + procrustes[11]*pp2 + procrustes[15]*pp3;

  vec4 qq0 = preprocess[0]*q0 + preprocess[4]*q1 + preprocess[8]*q2 + preprocess[12]*q3;
  vec4 qq1 = preprocess[1]*q0 + preprocess[5]*q1 + preprocess[9]*q2 + preprocess[13]*q3;
  vec4 qq2 = preprocess[2]*q0 + preprocess[6]*q1 + preprocess[10]*q2 + preprocess[14]*q3;
  vec4 qq3 = preprocess[3]*q0 + preprocess[7]*q1 + preprocess[11]*q2 + preprocess[15]*q3;
  vec4 qqq0 = procrustes_prev[0]*qq0 + procrustes_prev[4]*qq1 + procrustes_prev[8]*qq2 + procrustes_prev[12]*qq3;
  vec4 qqq1 = procrustes_prev[1]*qq0 + procrustes_prev[5]*qq1 + procrustes_prev[9]*qq2 + procrustes_prev[13]*qq3;
  vec4 qqq2 = procrustes_prev[2]*qq0 + procrustes_prev[6]*qq1 + procrustes_prev[10]*qq2 + procrustes_prev[14]*qq3;
  vec4 qqq3 = procrustes_prev[3]*qq0 + procrustes_prev[7]*qq1 + procrustes_prev[11]*qq2 + procrustes_prev[15]*qq3;

  p0 = mix(qqq0, ppp0, t);
  p1 = mix(qqq1, ppp1, t);
  p2 = mix(qqq2, ppp2, t);
  p3 = mix(qqq3, ppp3, t);

  pp0 = gt_matrix[0]*p0 + gt_matrix[4]*p1 + gt_matrix[8]*p2 + gt_matrix[12]*p3;
  pp1 = gt_matrix[1]*p0 + gt_matrix[5]*p1 + gt_matrix[9]*p2 + gt_matrix[13]*p3;
  pp2 = gt_matrix[2]*p0 + gt_matrix[6]*p1 + gt_matrix[10]*p2 + gt_matrix[14]*p3;
  pp3 = gt_matrix[3]*p0 + gt_matrix[7]*p1 + gt_matrix[11]*p2 + gt_matrix[15]*p3;



  gl_Position = postprocess[0] * pp0
              + postprocess[1] * pp1
              + postprocess[2] * pp2
              + postprocess[3] * pp3;


  gl_Position.x = (gl_Position.x - xDataMin) / (xDataMax - xDataMin) * 2.0 - 1.0;
  gl_Position.y = (gl_Position.y - yDataMin) / (yDataMax - yDataMin) * 2.0 - 1.0;
  gl_Position.z = (gl_Position.z - zDataMin) / (zDataMax - zDataMin);
  gl_Position.w = 1.0;

  gl_Position.z *= 0.001;

  
  if(is_brushing > 0.0){
    bool tmp_brushed = 
       (gl_Position.x > brush_0.x)
    && (gl_Position.x < brush_0.y)
    && (gl_Position.y > brush_0.z)
    && (gl_Position.y < brush_0.w)
    && (gl_Position.x > brush_1.x)
    && (gl_Position.x < brush_1.y)
    && (gl_Position.y > brush_1.z)
    && (gl_Position.y < brush_1.w);
    v_selected = tmp_brushed ? 1.0 : -1.0;
  }else{
    v_selected = is_brushed > 0.0 ? 1.0: -1.0;
  }


  //for image mode
  if(a_mode < 0.01){ //point mode;
    gl_PointSize = point_size;
  }else if(a_mode < 1.01){ // image mode
    gl_PointSize = point_size * 3.0;
  }
  
  v_index = a_index; //for calculating image coord in frag shader.
  v_color = a_color;
  v_mode = a_mode;
  v_label = a_label;
  // TODO: depth cuing
  // TODO fix the z range in js
  // gl_PointSize = (point_size - min_size) * gl_Position.z + min_size;
  // float frac = smoothstep(fog_near,fog_far, gl_Position.z);
  // // v_color = mix(fog_color, a_color, 1.0);
  // v_color = mix(fog_color, a_color, frac); //depth cuing

  
}
