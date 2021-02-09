import {main} from './single';

let metaUrl = 'data/meta-googlenet-15D.json';
// let metaUrl = 'data/meta-googlenet-dogs-15D.json';
// let metaUrl = 'data/meta-googlenet-vehicles-15D.json';

window.onload = ()=>{
  main(metaUrl);
};
