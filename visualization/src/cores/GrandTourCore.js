import * as d3 from 'd3';
import * as numeric from 'numeric';
import * as math from 'mathjs';

window.math = math;

export default class GrandTourCore {
    constructor(ndim, stepsize){
        this._ndim = ndim || 2;
        this.STEPSIZE = stepsize || 3.0e-6;
        this._matrix = math.identity(this.ndim)._data;
        this.thetas = GrandTourCore.initThetas(ndim);
        this.t = 0; //internal clock for torus grand tour
    }

    //setter and getters
    set ndim(n){
        this._ndim = n;
        this.STEPSIZE = 0.0001 / this._ndim;
    }
    get ndim(){
        return this._ndim;
    }


    set matrix(m){
        this._matrix = numeric.clone(m);
    }
    get matrix(){
        return this._matrix;
    }


    step(dt){
        if (dt !== undefined && this.STEPSIZE > 1e-9) {
            let angles = this.thetas.map((th) => th * dt * this.STEPSIZE);
            let k = 0;
            for (let i=0; i<this.ndim; i++) {
                for (let j=0; j<this.ndim; j++) {
                    if (i!==j && (true || i<=3 || j<=3) ) {
                        this._matrix = this.multiplyRotationMatrix(
                            this._matrix, i, j, angles[k]);
                        k++;
                    }
                }
            }
        }
    }


    step2(dt){
        //torus method
        this.t += (dt || 0)*this.STEPSIZE;
        if (dt !== undefined && this.STEPSIZE > 0) {
            this._matrix = math.identity(this.ndim)._data;
            let angles = this.thetas.map((th) => th * this.t);
            let k = 0;
            for (let i=0; i<this.ndim; i++) {
                for (let j=0; j<this.ndim; j++) {
                    if (i!==j && (true || i<=3 || j<=3) ) {
                        this._matrix = this.multiplyRotationMatrix(
                            this._matrix, i, j, angles[k]);
                        k++;
                    }
                }
            }
        }
    }


    getRotationMatrix(dim0, dim1, theta){
        let res = math.identity(this.ndim)._data;
        res[dim0][dim0] = Math.cos(theta);
        res[dim0][dim1] = Math.sin(theta);
        res[dim1][dim0] = -Math.sin(theta);
        res[dim1][dim1] = Math.cos(theta);
        return res;
    }


    multiplyRotationMatrix(matrix, i, j, theta){
        if(theta == 0){
            return matrix;
        }
        let sin = Math.sin(theta);
        let cos = Math.cos(theta);
        // var res = matrix.map(d=>d.slice());
        let columnI = matrix.map((d)=>d[i]);
        let columnJ = matrix.map((d)=>d[j]);
        for (let rowIndex=0; rowIndex<matrix.length; rowIndex++) {
            matrix[rowIndex][i] = columnI[rowIndex]*cos + columnJ[rowIndex]*(-sin);
            matrix[rowIndex][j] = columnI[rowIndex]*sin + columnJ[rowIndex]*cos;
        }
        return matrix;
    }


    project(data, dt, leftview, rightview){
        this.step(dt);
        let matrix = this.matrix;
        matrix = math.transpose(matrix);
        matrix = matrix.slice(0, 3);
        matrix = math.transpose(matrix);
        if(leftview!==undefined){
            matrix = math.multiply(leftview, matrix);
        }
        if(rightview!==undefined){
            matrix = math.multiply(matrix, rightview);
        }
        let res = math.multiply(data, matrix.slice(0,data[0].length));
        this.lastRes = res;
        return res;
    }


    //class methods
    static initThetas(ndim){
        let n = ndim*ndim;
        return d3.range(n).map(d=>Math.random() * 2 * Math.PI);
    }


}