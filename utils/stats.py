#!/bin/env python

import os, math, sys
import numpy as np
import nmslib

def doStats(infile, outfile):
    vecs = np.load(infile)
    print('loaded file: ' + infile)
    print('creating neighborhood index...')
    index = nmslib.init(method='hnsw', space='cosinesimil')
    index.addDataPointBatch(vecs)
    index.createIndex({'post': 2}, print_progress=True)
    print('index created, querying neighbors...')
    neighbors = index.knnQueryBatch(vecs, k=100, num_threads=4)
    #neighbors = np.load('/home/flo/uni/code/viswordembeddings/data/embeddings/experiments/100_nns_wiki.npy')
    
    stats = []
    #start from 1 because lists contain vector itself as nn
    for i in range(1,31):
        dists = [distlist[i] for nlist, distlist in neighbors]
        dists.sort()
        lowlist = dists[:(len(dists)//2)]
        uplist = dists[(len(dists)//2):]
        median = dists[len(dists)//2]
        upquart = uplist[len(uplist)//2]
        lowquart = lowlist[len(lowlist)//2]
        up = dists[-1]
        low = dists[0]
        stats_tuple = (low,lowquart,median,upquart,up)
        print(str(i) + ': ' + str(stats_tuple))
        stats.append(stats_tuple)
    np.save(outfile, stats)

if __name__ == '__main__':
    
    if len(sys.argv) != 3:
        print('create nearest neighborhood stats for word embedding numpy matrix')
        print('usage: <numpy matrix file><outfile>')
    else:
        doStats(sys.argv[1], sys.argv[2])


