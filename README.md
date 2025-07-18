# Visualizing Deep Neural Nets with UMAP Tour

[[Demo]](https://umap-tour.github.io/index.html)



## Get the Source Code

```git clone git@github.com:umap-tour/source.git ./umap-tour```


## Run Visualizations
1. ```cd ./umap-tour/visualization```
2. ```npm install```
3. ```npm run start```
4. Go to http://localhost:8080


This repository contains all data needed to run the website. To regenerate the data or generate data from other models, please refer to the info below.
## Computing UMAP

1. Get the source code. Assume it is under ./umap-tour/. 
2. Download ImageNet validation set [[link]](http://www.image-net.org/) to ./umap-tour/dataset/imagenet/val
2. Open data-processing.ipynb in Jupiter notebook:

   - ```cd ./umap-tour/data-processing/```
- ```jupyter notebook```
   - open data-processing.ipynb
4. (Only need once) uncomment the first code block to install requirements via pip
5. Run All. The UMAP embeddings will be stored in ./umap-tour/out/ . 
6. Note: the data can be used in the visualization (see existing data in ./umap-tour/visualization/static/data/) 



