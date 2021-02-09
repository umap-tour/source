const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');


let chunks = {
    resnet50_15D_50000: './src/main-single-resnet50-15D.js',
    googlenet_15D_50000: './src/main-single-googlenet-15D.js',
    googlenet_train_15D_50000: './src/main-single-googlenet-train-15D.js',
    fairface: './src/main-single-fairface.js',
    compare_imagenet: './src/main-compare-imagenet.js',
};

let pages = [
    {
        title: "ResNet50 Tour", 
        template: "./src/single.html", 
        filename: "resnet50.html", 
        chunks: ['resnet50_15D_50000'],
    },
    {
        title: "GoogLeNet Tour", 
        template: "./src/single.html", 
        filename: "googlenet.html", 
        chunks: ['googlenet_15D_50000'],
    },
    {
        title: "GoogLeNet Training Tour", 
        template: "./src/single.html", 
        filename: "googlenet-train.html", 
        chunks: ['googlenet_train_15D_50000'],
    },
    {
        title: "Compare", 
        template: "./src/compare.html", 
        filename: "compare-imagenet.html", 
        chunks: ['compare_imagenet'],
    },
    {
        title: "Fairface Tour", 
        template: "./src/single.html", 
        filename: "fairface.html", 
        chunks: ['fairface'],
    },
];
console.log(pages.map(d=>d.filename));


module.exports = {
    entry: chunks,
    node: {
        fs: 'empty'
    },
    plugins: [
        new CleanWebpackPlugin(),
        ...pages.map(p=>new HtmlWebpackPlugin(p)),
        new CopyWebpackPlugin([ { from: 'static/' } ]),
    ],
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'public')
    },
    module: {
        rules: [
            {
                test: /\.(frag|vert|glsl)$/,
                use: [{ loader: 'glsl-shader-loader',
                        options: {}  }]
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
        ]
    }
};
