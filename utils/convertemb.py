#!/bin/env python

import os, math, sys
import numpy as np

def convert(filename, context=False):
    terms = []
    vecs = []
    context_vecs = []
    biases = []
    context_biases = []
    with open(filename, 'r') as vector_file:
        if (context):
            for line in vector_file:
                split_line = line.split()
                split_point = int((len(split_line) / 2))
                vec = np.array(split_line[1:split_point], dtype=float)
                if (np.count_nonzero(vec)): #ignore zero vectors
                    vecs.append(vec)
                    terms.append(split_line[0])
                    biases.append(float(split_line[split_point]))
                    context_vecs.append(np.array(split_line[split_point+1:-1], dtype=float))
                    context_biases.append(float(split_line[-1]))
        else:
            for line in vector_file:
                split_line = line.split()
                vec = np.array(split_line[1:], dtype=float)
                if (np.count_nonzero(vec)): #ignore zero vectors
                    vecs.append(vec)
                    terms.append(split_line[0])

    np.save(filename + '_terms', terms)
    np.save(filename + '_vecs', np.array(vecs))
    if len(context_vecs) > 0:
        np.save(filename + '_cvecs', np.array(context_vecs))
    if len(biases) > 0:
        np.save(filename + '_biases', np.array(biases))
    if len(context_biases) > 0:
        np.save(filename + '_cbiases', np.array(context_biases))

if __name__ == '__main__':
    
    if len(sys.argv) != 3 or not sys.argv[1] in ['c0', 'c1']:
        print('convert txt style word embeddings (c0 = no context vectors, c1 = including context vectors) to numpy matrices')
        print('usage: <c0|c1><txt file>')
    else:
        context = (sys.argv[1] == 'c1')
        infile = os.path.abspath(sys.argv[2])
        convert(infile, context)


