import {main} from './compare';

let metaUrl_1 = 'data/meta-resnet50-15D.json';
let metaUrl_2 = 'data/meta-googlenet-15D.json';
let simUrl = 'data/similarity/resnet50-vs-googlenet-25x21.bin';
window.onload = ()=>{
  main([metaUrl_1, metaUrl_2], simUrl);
};
