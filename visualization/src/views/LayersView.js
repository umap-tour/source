import * as d3 from 'd3';
import * as utils from '../utils/utils';
import * as numeric from 'numeric';

const defaultArchTemplate = [
  {index:0, id: 'input'},
  {index:1, id: 'stem'},
  {index:2, id: '0-InferCell'},
  {index:3, id: '1-InferCell'},
  {index:4, id: '2-InferCell'},
  {index:5, id: '3-InferCell'},
  {index:6, id: '4-InferCell'},
  {index:7, id: '5-ResNetBasicblock'},
  {index:8, id: '6-InferCell'},
  {index:9, id: '7-InferCell'},
  {index:10, id: '8-InferCell'},
  {index:11, id: '9-InferCell'},
  {index:12, id: '10-InferCell'},
  {index:13, id: '11-ResNetBasicblock'},
  {index:14, id: '12-InferCell'},
  {index:15, id: '13-InferCell'},
  {index:16, id: '14-InferCell'},
  {index:17, id: '15-InferCell'},
  {index:18, id: '16-InferCell'},
  {index:19, id: 'lastact'},
  {index:20, id: 'global_pooling'},
  {index:21, id: 'out'},
  {index:22, id: 'logit'}
];


const inferCellTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[1,2]},
    {id: 2, pos:[2,1]},
    {id: 3, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'none',
      path: [[0,1],[1,2]],
    },
    {
      id: [0,2], 
      type: 'none',
      path: [[0,1],[2,1]],
    },
    {
      id: [1,2], 
      type: 'nor_conv_1x1',
      path: [[1,2], [2,1]],
    },
    {
      id: [0,3], 
      type: 'skip_connect',
      path: [[0,1],[1,0],[3,0],[4,1]],
    },
    {
      id: [1,3], 
      type: 'nor_conv_3x3',
      path: [[1,2], [3,2], [4,1]],
    },
    {
      id: [2,3], 
      type: 'avg_pool_3x3',
      path: [[2,1], [4,1]],
    },
  ]
};

const residualCellTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[2,0]},
    {id: 2, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'conv_a',
      path: [[0,1],[2,0]],
    },
    { 
      id: [1,2], 
      type: 'conv_b',
      path: [[2,0],[4,1]],
    },
    { 
      id: [0,2], 
      type: 'downsample',
      path: [[0,1], [2,2],[4,1]],
    },
  ]
};

const stemTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'conv_3x3',
      path: [[0,1],[4,1]],
    },
  ]
};

const lastActTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'lastact',
      path: [[0,1],[4,1]],
    },
  ]
};

const globalPoolingTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'avg_pool',
      path: [[0,1],[4,1]],
    },
  ]
};

const classifierTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'linear',
      path: [[0,1],[4,1]],
    },
  ]
};

const softmaxTemplate = {
  nodes: [
    {id: 0, pos:[0,1]},
    {id: 1, pos:[4,1]},
  ],
  edges: [
    { 
      id: [0,1], 
      type: 'softmax',
      path: [[0,1],[4,1]],
    },
  ]
};

const inputTemplate = {
  nodes: [
    {id: 0, pos:[4,1]},
  ],
  edges: []
};




const hexTemplate = {
  path: [[0,1],[1,2],[3,2],[4,1],[3,0],[1,0],[0,1]],
};

const rectTemplate = {
  path: [[0.5,0],[0.5,2],[3.5,2],[3.5,0]],
};

const diamondTemplate = {
  path: [[0,1],[2,2],[4,1],[2,0]],
};


const op_color = [
  //stem:
  {id: 'conv_3x3', color: '#ffffb2'}, 
  // infer cell:
  {id: 'none', color: 'black'}, 
  {id: 'skip_connect', color: 'white'}, 
  {id: 'nor_conv_1x1', color: '#fecc5c'}, 
  {id: 'nor_conv_3x3', color: '#ffffb2'}, 
  {id: 'avg_pool_3x3', color: '#c7d5ff'}, 
  // residual cell:
  {id: 'conv_a', color: '#ffffd4'}, 
  {id: 'conv_b', color: '#fed98e'}, 
  {id: 'downsample', color: '#bdd7e7'}, 
  //lastact:
  {id: 'lastact', color: 'white'}, 
  //global_pooling:
  {id: 'avg_pool', color: '#c7d5ff'}, 
  //classifier:
  {id: 'linear', color: '#fecc5c'}, 
  {id: 'softmax', color: '#fecc5c'}, 
];

const operations = op_color.map(d=>d.id);
const colors = op_color.map(d=>d.color);

const infer_cell_bg = '#4292c6';
const residual_cell_bg = '#ec7014';
const cell_opacity = 0.75;

let screen_size = Math.min(window.innerWidth, window.innerHeight);
let edge_stroke_width = 3 / Math.sqrt(969) * Math.sqrt(screen_size); // about 3 on a 1485 x 969px screen
let node_stroke_width = 1.5 / Math.sqrt(969) * Math.sqrt(screen_size);
let node_radius = 4 / Math.sqrt(969) * Math.sqrt(screen_size);

export default class LayersView{
  constructor(svg, 
  archs, archTemplate, keys, epoch_arch_to_dir, 
  epochIndex, archIndex, layerIndex, 
  style){
    
    if(style!==undefined){
      if(style.edge_stroke_width !== undefined){
        edge_stroke_width = style.edge_stroke_width;
      }
      if(style.node_stroke_width !== undefined){
        node_stroke_width = style.node_stroke_width;
      }
      if(style.node_radius !== undefined){
        node_radius = style.node_radius;
      }
      this.margin = style.margin || 20;
      this.marginLeft = style.marginLeft || this.margin;
      this.marginRight = style.marginRight || this.margin;
      this.marginTop = style.marginTop || this.margin*2;
      this.marginBottom = style.marginBottom || this.margin*2;
    }else{
      this.margin = 10;
      this.marginLeft = this.margin;
      this.marginRight = this.margin;
      this.marginTop = this.margin*2;
      this.marginBottom = this.margin*2;
    }
    
    this.cached = {};
    this.svg = svg;
    this.archs = archs;
    this.archTemplate = archTemplate;
    this.keys = keys;
    this.epoch_arch_to_dir = epoch_arch_to_dir;

    this.inferCellTemplate = inferCellTemplate;
    this.residualCellTemplate = residualCellTemplate;

    this.num_cells = this.archTemplate.length;
    this.sc = d3.scaleOrdinal(colors).domain(operations);
    this.updateScale();

    this.setEpoch(epochIndex);
    this.setArch(archIndex);
    this.setLayer(layerIndex);
  }

  setEpoch(epochIndex){
    this.epochIndex = epochIndex;
  }

  setLayer(layerIndex){
    this.layerIndex = layerIndex;
    this.drawArrow(layerIndex);
  }


  setArch(archIndex){
    if(this.archIndex === archIndex){
      return;
    }else{
      this.archIndex = archIndex;
      let archStr = this.archs[archIndex];
      let edges = utils.archStr2edges(archStr);
      this.inferCellTemplate.edges.forEach((d,i)=>{
        d.type = edges[i];
      });
      this.draw(archIndex);
      this.drawResidualIndicator(this.epochIndex, archIndex);
    }
  }


  updateScale(){
    this.width = this.svg.node().getBoundingClientRect().width;
    this.height = this.svg.node().getBoundingClientRect().height;
    
    let left = this.marginLeft;
    let right = this.width - this.marginRight;
    let top = this.marginTop;
    let bottom = this.height - this.marginBottom;

    this.inferCellWidth = (right-left) / this.num_cells;
    this.inferCellHeight = Math.min(bottom-top, this.inferCellWidth * Math.sqrt(3)/2 );
    
    // TODO: allow none-uniform sx
    this.sx = d3.scaleLinear()
    .domain([0, this.num_cells])
    .range([left, right]);
    this.sy = d3.scaleLinear()
    .domain([0, 1])
    .range([top, bottom]);

    let w = this.inferCellWidth;
    let h = this.inferCellHeight;

    this.hexSx = d3.scaleLinear()
    .domain([0,4])
    .range([0,w]);
    this.hexSy = d3.scaleLinear()
    .domain([0,2])
    .range([0,h])

    this.inferCellSx = d3.scaleLinear()
    .domain([0,  1,    2,      3,])
    .range([ 0,  w/4,  w/4*2,  w]);
    this.inferCellSy = d3.scaleLinear()
    .domain([0,1,2,3])
    .range([h/2, h, h/2, h/2]);



  }

  mouseOverCell(d,i){
    d.hovered = true;
    this.cells.attr('opacity', e=>{
      return (this.clickedLayer==e.index || e.hovered)?1.0:cell_opacity;
    });
    this.cells.selectAll('text')
    .attr('opacity', e=>{
      return (this.clickedLayer==e.index || e.hovered) ? 1.0:0.0;
    });
  }

  mouseOutCell(d,i){
    d.hovered = null;
    this.cells.attr('opacity', e=>{
      if(this.clickedLayer===undefined){
        return 1.0;
      }else{
        return (this.clickedLayer==e.index)?1.0:cell_opacity;
      }
    });
    this.cells.selectAll('text')
    .attr('opacity', e=>{
      return (this.clickedLayer==e.index || e.hovered) ? 1.0:0.0;
    });
  }

  clickCell(d,i){
    console.log('clicked layer', d.index);
    if(this.clickedLayer === d.index){
      //cancel click
      this.clickedLayer = undefined;
    }else{
      this.clickedLayer = d.index;
    }
    this.cells.attr('opacity', e=>{
      if(this.clickedLayer===undefined){
        return 1.0;
      }else{
        return (this.clickedLayer==e.index)?1.0:cell_opacity;
      }
    });
    this.cells.selectAll('text')
    .attr('opacity', e=>{
      return (this.clickedLayer==e.index) ? 1.0:0.0;
    });

    this.setLayer(d.index);
    if(this.gv !== undefined){
      this.gv.onLayerClick(d.index);
    }
  }

  // onGvInit(archIndex, layerIndex){
  //   this.draw(archIndex);
  //   this.drawArrow(layerIndex);
  // }

  onUmapClick(archIndex){
    this.setArch(archIndex);
    // this.clickCell(this.cells.data()[this.gv.layerIndex], this.gv.layerIndex);
  }



  drawArrow(cellIndex){
    let arrowStart = {
      x: this.sx(cellIndex + 1),
      y: this.sy(0.5)
    };
    let arrowEnd = {
      x: this.width / 4 * 3, 
      y:0
    };

    let yFrac = 0.5;
    let arrowMiddleY = (arrowStart.y-this.inferCellHeight/2) * yFrac + arrowEnd.y*(1-yFrac);

    let dr = arrowStart.x < arrowEnd.x ? +8:-8;


    if(this.arrow === undefined){
      this.arrow = this.svg.selectAll('.arrow')
      .data([cellIndex,])
      .enter()
      .append('g')
      .attr('class', 'arrow');

      this.arrow.append('circle')
      .attr('r', 5)
      .attr('fill', '#272727')
      .attr('opacity', 0);

      this.arrow.append('path')
      .attr('class', 'arrow-path');
    }

    this.arrow
    .selectAll('circle')
    .attr('transform', `translate(${arrowStart.x},${arrowStart.y})`);
    this.arrow
    .selectAll('.arrow-path')
    .attr('stroke', '#272727')
    .attr('stroke-width', edge_stroke_width)
    .attr('fill', 'none')
    .attr('d', 
      `M ${arrowStart.x} ${arrowStart.y - node_radius - node_stroke_width} 
      L ${arrowStart.x} ${arrowMiddleY + Math.abs(dr)} 
      C ${arrowStart.x} ${arrowMiddleY + Math.abs(dr)/3} 
        ${arrowStart.x + dr/3} ${arrowMiddleY} 
        ${arrowStart.x + dr} ${arrowMiddleY} 
      L ${arrowEnd.x - dr} ${arrowMiddleY}
      C ${arrowEnd.x + dr/3} ${arrowMiddleY} 
        ${arrowEnd.x} ${arrowMiddleY - Math.abs(dr)/3} 
        ${arrowEnd.x} ${arrowMiddleY - Math.abs(dr)} 
      L ${arrowEnd.x} ${arrowEnd.y}`
    );

  }


  draw(epochIndex, archIndex){
    if(this.sx === undefined){
      this.updateScale();
    }
    let newCells = this.svg.selectAll('.cell')
    .data(this.archTemplate)
    .enter()
    .append('g')
    .attr('class', 'cell');
    
    //debug only, should be invisible in final version
    newCells
    .append('rect')
    .attr('class', 'boundingBox')
    .attr('width', this.inferCellWidth)
    .attr('height', this.inferCellHeight)
    .attr('stroke', '#fff')
    .attr('stroke-dasharray', '2 2')
    .attr('stroke-width', 1.4 / 969 * window.innerHeight) // about 1.4 on a 1485 x 969px screen
    .attr('fill', 'white')
    .attr('opacity', 0.0001);


    let that = this;
    this.cells = this.svg.selectAll('.cell');
    this.cells.attr('transform', (d,i)=>{
      return `translate(${this.sx(i)},${this.sy(0.5) - this.inferCellHeight/2})`
    })
    .each(function(d,i){
      d3.select(this).call(that.drawCell, that, d);
    })
    .on('mouseover', this.mouseOverCell.bind(this))
    .on('mouseout', this.mouseOutCell.bind(this))
    .on('click', this.clickCell.bind(this));

  }//draw end


  drawCell(g, self, d){
    g.selectAll('text')
    .data([d])
    .enter()
    .append('text')
    .attr('fill', '#eee')
    .attr('font-size', '0.6rem')
    .attr('alignment-baseline', 'bottom')
    .attr('text-anchor', 'middle')
    .attr('x', self.hexSx(2))
    .attr('y', -5)
    .attr('opacity', 0.0)
    .text(d=>d.id);

    let cell = g.data()[0];

    if(cell.id.includes('input')){
      self.drawSimpleCell(self, g, inputTemplate);
    }else if(cell.id.includes('stem')){
      self.drawSimpleCell(self, g, stemTemplate);
    }else if (cell.id.includes('InferCell') 
    || cell.id.includes('GDAS-Cell')
    || cell.id.includes('DARTS-Cell')){
      self.drawInferCell(self, g);
    }else if (cell.id.includes('ResNetBasicblock')){
      self.drawResidualCell(self, g);
    }else if (cell.id.includes('lastact')){
      self.drawSimpleCell(self, g, lastActTemplate);
    }else if (cell.id.includes('global_pooling') || cell.id.includes('out')){
      self.drawSimpleCell(self, g, globalPoolingTemplate);
    }else if (cell.id.includes('classifier') || cell.id.includes('logit')){
      self.drawSimpleCell(self, g, classifierTemplate);
    }else if (cell.id.includes('softmax')){
      self.drawSimpleCell(self, g, softmaxTemplate);
    }else{
      //TODO: design better glyphs for other types of cells
      self.drawRect(self, g);
    }
  }
  
  drawSimpleCell(self, g, template){
    let line = d3.line()
    .x(d=>self.hexSx(d[0]))
    .y(d=>self.hexSy(d[1]))
    .curve(d3.curveLinear);

    //bg
    // this.drawDiamond(self, g, residual_cell_bg);

    g.selectAll('.edge')
    .data(template.edges)
    .enter()
    .append('path')
    .attr('class', 'edge')
    .attr('stroke-width', edge_stroke_width)
    .attr('stroke', '#eee')
    .attr('fill', 'none')
    .append('title');

    g.selectAll('.node')
    .data(template.nodes)
    .enter()
    .append('circle')
    .attr('class', 'node')
    .attr('r', node_radius)
    .attr('fill', '33f')
    .attr('stroke', '#fff')
    .attr('stroke-width', node_stroke_width)
    .append('title');

    let nodes = g.selectAll('.node')
    .attr('cx', d=>self.hexSx(d.pos[0]))
    .attr('cy', d=>self.hexSy(d.pos[1]))

    nodes
    .selectAll('title')
    .text(d=>`${d.id}`);

    let edges = g.selectAll('.edge')
    .attr('d', d=>line(d.path))
    .attr('stroke', d=>this.sc(d.type))
    .attr('opacity', d=>d.type=='none'? 0.1 : 1.0);
    
    edges
    .selectAll('title')
    .text(d=>`${d.type}: ${d.id[0]} -> ${d.id[1]} `);
  }
  
  drawRect(self, g, color='#a2d8ff'){
    let line = d3.line()
    .x(d=>self.hexSx(d[0]))
    .y(d=>self.hexSy(d[1]))
    .curve(d3.curveLinear);

    g.selectAll('.rect-bg')
    .data([rectTemplate, ])
    .enter()
    .append('path')
    .attr('class', 'rect-bg')
    .attr('fill', d=>color)
    .attr('stroke', 'none')
    .attr('opacity', 1.0)
    .attr('d', d=>line(d.path));
  }
    
  drawDiamond(self, g, color='white'){
    let line = d3.line()
    .x(d=>self.hexSx(d[0]))
    .y(d=>self.hexSy(d[1]))
    .curve(d3.curveLinear);

    g.selectAll('.diamond-bg')
    .data([diamondTemplate, ])
    .enter()
    .append('path')
    .attr('class', 'diamond-bg')
    .attr('fill', d=>color)
    .attr('stroke', 'none')
    .attr('opacity', 1.0)
    .attr('d', d=>line(d.path));
  }

  drawHex(self, g, color='white'){
    let line = d3.line()
    .x(d=>self.hexSx(d[0]))
    .y(d=>self.hexSy(d[1]))
    .curve(d3.curveLinear);

    //hex bg
    g.selectAll('.hex-bg')
    .data([hexTemplate, ])
    .enter()
    .append('path')
    .attr('class', 'hex-bg')
    .attr('fill', d=>color)
    .attr('stroke', 'none')
    .attr('opacity', 1.0)
    .attr('d', d=>line(d.path));
  }


  drawResidualCell(self, g){
    this.drawDiamond(self, g, residual_cell_bg);
    this.drawSimpleCell(self, g, self.residualCellTemplate);
  }


  drawInferCell(self, g){
    this.drawHex(self, g, infer_cell_bg);//hex bg
    this.drawSimpleCell(self, g, self.inferCellTemplate);
  }


  getSchema(schemaUrl){
    if(schemaUrl in this.cached){
      return new Promise(()=>{
        return this.cached[schemaUrl];
      });
    }else{
      return d3.json(schemaUrl);
    }
  }


  drawResidualIndicator(epochIndex, archIndex){
    this.sxIndicator = this.sx;
    let dir = this.epoch_arch_to_dir[`${epochIndex},${archIndex}`];

    let schemaUrl = `data/${dir}/schema.json`;
    
    this.getSchema(schemaUrl)
    .then((schema)=>{
      this.cached[schemaUrl] = schema;
      let layers = schema.layers;
      layers.forEach((d,i)=>{
        d.index = i;
      })

      this.scIndicator = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, Math.sqrt(d3.max(layers, d=>d.residual))]);

      this.sOpacity = d3.scaleLinear()
      .domain([0, d3.max(layers, d=>d.residual)]);

      this.cells.each(function(d,i){
        d3.select(this)
        .selectAll('.residual-indicator')
        .data([layers[i],])
        .enter()
        .append('circle')
        .attr('class', 'residual-indicator');
      });
      
      let r = node_radius;
      this.residualIndicator = this.svg.selectAll('.residual-indicator');
      this.residualIndicator
      .data(layers)
      .attr('cx', (d,i)=>this.inferCellWidth / 2)
      .attr('cy', (d,i)=>this.inferCellHeight + 2.5*r + r)
      .attr('r', r)
      .attr('stroke', d=>d3.color(this.scIndicator(Math.sqrt(d.residual))).brighter())
      .attr('stroke-width', 0)//node_stroke_width/2)
      .attr('fill', d=>this.scIndicator(Math.sqrt(d.residual)))
      // .attr('fill', '#ffd500')
      // .attr('opacity', d=>this.sOpacity(d.residual));

    
    });
  }
  
  
}

















