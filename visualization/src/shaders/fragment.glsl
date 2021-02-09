precision mediump float;

// uniform float nrow;
// uniform float ncol;

varying vec4 v_color;
varying float v_index;
varying float v_selected;
varying float v_mode;
varying float v_label;
uniform float selected_labels[1000];

uniform sampler2D imageTexture_0;
uniform sampler2D imageTexture_1;
uniform sampler2D imageTexture_2;
uniform sampler2D imageTexture_3;
uniform sampler2D imageTexture_4;
uniform sampler2D imageTexture_5;
uniform sampler2D imageTexture_6;
uniform sampler2D imageTexture_7;
uniform sampler2D imageTexture_8;
uniform sampler2D imageTexture_9;
uniform sampler2D imageTexture_10;
uniform sampler2D imageTexture_11;
uniform sampler2D imageTexture_12;
uniform sampler2D imageTexture_13;
uniform sampler2D imageTexture_14;

void colorByLabel(float radius_multiplier, float alpha_multiplier){
  gl_FragColor = v_color;
  //rounded points
  float dist = distance(vec2(0.5, 0.5), gl_PointCoord);
  float eps = 0.1;
  float g = 1.0 - smoothstep((0.5-eps)*radius_multiplier, 0.5*radius_multiplier, dist);
  gl_FragColor.a = v_color.a * g * alpha_multiplier;

  vec3 outline_color = mix(vec3(1.0, 1.0, 1.0), gl_FragColor.rgb, 0.2);
  // vec3 outline_color = gl_FragColor.rgb;
  gl_FragColor.rgb = mix(
    gl_FragColor.rgb,
    outline_color,
    smoothstep(0.4, 0.5, dist)
    );
}


void colorByImage(float alpha_multiplier){
  float nrow = 100.0;
  float ncol = 100.0;
  float imagePerTexture = nrow*ncol;
  //// image
  float v_index1 = mod(v_index, imagePerTexture);
  vec2 coord = vec2(
    1.0 / ncol * mod(v_index1, ncol), 
    1.0 / nrow * floor(v_index1 / ncol)
  );
  coord.x += gl_PointCoord.x / ncol;
  coord.y += gl_PointCoord.y / nrow;
  
  float margin = 0.1;
  bool no_boarder = true;
  if( no_boarder ||
    gl_PointCoord.x > margin 
  && gl_PointCoord.x < 1.0-margin 
  && gl_PointCoord.y > margin
  && gl_PointCoord.y < 1.0-margin ){

    if(v_index < imagePerTexture){
      gl_FragColor = texture2D(imageTexture_0, coord);
    }else if(v_index < imagePerTexture*2.0){
      gl_FragColor = texture2D(imageTexture_1, coord);
    }else if(v_index < imagePerTexture*3.0){
      gl_FragColor = texture2D(imageTexture_2, coord);
    }else if(v_index < imagePerTexture*4.0){
      gl_FragColor = texture2D(imageTexture_3, coord);
    }else if(v_index < imagePerTexture*5.0){
      gl_FragColor = texture2D(imageTexture_4, coord);
    }else if(v_index < imagePerTexture*6.0){
      gl_FragColor = texture2D(imageTexture_5, coord);
    }else if(v_index < imagePerTexture*7.0){
      gl_FragColor = texture2D(imageTexture_6, coord);
    }else if(v_index < imagePerTexture*8.0){
      gl_FragColor = texture2D(imageTexture_7, coord);
    }else if(v_index < imagePerTexture*9.0){
      gl_FragColor = texture2D(imageTexture_8, coord);
    }else if(v_index < imagePerTexture*10.0){
      gl_FragColor = texture2D(imageTexture_9, coord);
    }else if(v_index < imagePerTexture*11.0){
      gl_FragColor = texture2D(imageTexture_10, coord);
    }else if(v_index < imagePerTexture*12.0){
      gl_FragColor = texture2D(imageTexture_11, coord);
    }else if(v_index < imagePerTexture*13.0){
      gl_FragColor = texture2D(imageTexture_12, coord);
    }else if(v_index < imagePerTexture*14.0){
      gl_FragColor = texture2D(imageTexture_13, coord);
    }else{
      gl_FragColor = texture2D(imageTexture_14, coord);
    }

  }else{
    //make a border;
    gl_FragColor = v_color;
  }
  gl_FragColor.a *= alpha_multiplier;
}



void main() {
  float label_selected = -1.0;
  if(selected_labels[0] == -1.0){ // if no label is selected, show points anyway 
    label_selected = 1.0;
  }else{
    for(int i=0; i<1000; i++){
      if(selected_labels[i] == -1.0){
        break;
      }
      if (v_label == selected_labels[i]){
        label_selected = 1.0;
        break;
      }
    }
  }
  
  float selected = (label_selected > 0.0 && v_selected > 0.0) ? 1.0: -1.0;
  float alpha_multiplier = selected > 0.0 ? 0.9 : 0.02;


  if(selected > 0.0){
    if(v_mode < 0.01){// point mode
      colorByLabel(1.0, alpha_multiplier);
    }else if(v_mode < 1.01){// image mode
      colorByImage(1.0);
    }
  }else{
    if(v_mode < 0.01){// point mode
      colorByLabel(1.0, alpha_multiplier);
    }else if(v_mode < 1.01){// image mode
      colorByLabel(1.0/2.5, alpha_multiplier);
    }
  }
}

