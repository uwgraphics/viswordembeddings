import os, math
import numpy as np
from scipy.spatial import distance
from heapq import nsmallest, nlargest
import sharearray

pass_filter = lambda x: not x in stopwords

def strip_filename(filename):
    afterslash = filename.split('/')[-1]
    beforedot = afterslash.split('.')[:-1]
    return '.'.join(beforedot)

class Embedding(object):
    
    def del_stuff(self):
        sharearray.free(strip_filename(self.terms_filename))
        sharearray.free(strip_filename(self.vecs_filename))
        if (self.context):
            sharearray.free(strip_filename(self.cvecs_filename))
            sharearray.free(strip_filename(self.biases_filename))
            sharearray.free(strip_filename(self.cbiases_filename))
    
    def __init__(self, root_filename, stopwords = set()):
        print('root filename: ' + root_filename)
        self.stopwords = stopwords
        self.root_filename = root_filename
        self.terms_filename = root_filename + '_terms.npy'
        self.vecs_filename = root_filename + '_vecs.npy'
        self.cvecs_filename = root_filename + '_cvecs.npy'
        self.biases_filename = root_filename + '_biases.npy'
        self.cbiases_filename = root_filename + '_cbiases.npy'
        self.context = os.path.isfile(self.cvecs_filename)
        #read stuff
        self.terms = sharearray.cache(strip_filename(self.terms_filename), lambda: np.load(self.terms_filename))
        self.index = dict(((term, index) for index, term in enumerate(self.terms)))
        self.vecs = sharearray.cache(strip_filename(self.vecs_filename), lambda: np.load(self.vecs_filename))
        if (self.context):
            self.cvecs = sharearray.cache(strip_filename(self.cvecs_filename), lambda: np.load(self.cvecs_filename))
            self.biases = sharearray.cache(strip_filename(self.biases_filename), lambda: np.load(self.biases_filename))
            self.cbiases = sharearray.cache(strip_filename(self.cbiases_filename), lambda: np.load(self.cbiases_filename))
    
    def smashOnLine(self, term1, term2, wordlist=None):
        projectOn = lambda vec, vec1, diffVec : (np.dot(vec - vec1, diffVec))
        vec1 = self.vecs[self.index[term1]]#rich
        vec2 = self.vecs[self.index[term2]]#poor
        diff = vec2 - vec1
        norm = np.linalg.norm(diff)
        diff /= norm
        if wordlist:
            return ((term, projectOn(self.vecs[self.index[term]], vec1, diff)) for term in wordlist)
        else:
            return ((term, projectOn(self.vecs[self.index[term]], vec1, diff)) for term in vecs)

    def getSims(self, term, terms):
        vec = self.vecs[self.index[term]]
        index_list = [self.index[t] for t in terms if t in self.index]
        reduced_array = self.vecs[index_list,:]
        gen = enumerate((x[0] for x in distance.cdist(reduced_array, [vec], metric='cosine')))
        return [(self.terms[index_list[i]], ((1-dist)+1)/2) for i, dist in gen]

    def getNN(self, term, number=10):
        vec = self.vecs[self.index[term]]
        gen = enumerate((x[0] for x in distance.cdist(self.vecs, [vec], metric='cosine')))
        return [(self.terms[i], ((1-dist)+1)/2) for i, dist in nsmallest(number + 1, gen, key=lambda x:x[1])][1:]

    def hasContext(self):
        return self.context

    def getTermOccurrence(self, term, log=True):
        term_id = self.index[term]
        dot = np.dot(self.vecs[term_id], self.cvecs[term_id])
        dot += self.biases[term_id]
        dot += self.cbiases[term_id]
        if (log):
            return dot
        return np.exp(dot)

    def getContexts(self, term, log=True):
        if (not self.hasContext()):
            raise Exception('This embedding does not contain context vectors!')
        
        term_id = self.index[term]
        #print(np.dot(self.vecs[term_id], self.cvecs[0]) + self.cbiases[0] + self.biases[term_id])
        coocs = (self.vecs[term_id] * self.cvecs).sum(axis=1) + self.biases[term_id]# - self.cbiases# + self.biases[term_id]
        if (log):
            return coocs #/ self.getTermOccurrence(term, True)
        return np.exp(coocs)  #/ self.getTermOccurrence(term, False)
        
    def getContextCount(self, term, context_term, log=True):
        if (not self.hasContext()):
            raise Exception('This embedding does not contain context vectors!')

        term_id = self.index[term]
        context_id = self.index[context_term]
        log_val = np.dot(self.vecs[term_id], self.cvecs[context_id]) + self.biases[term_id]# - self.cbiases[context_id]# + self.biases[term_id]
        if (log):
            return log_val / self.getTermOccurrence(term, True)
        return np.exp(log_val) / self.getTermOccurrence(term, False)

    def getIndices(self, termList):
        return [self.index[term] for term in termList]

    def coocVariancesTerm(self, num, *terms):
        log=False
        context_lists = [self.getContexts(term, log) for term in terms]
        variances = np.array(context_lists).var(axis=0)
        filter_mask = np.array([int((self.terms[i] in self.stopwords)) for i in range(len(variances))])
        variances = variances * filter_mask
        return [(self.terms[i], var) for i, var in nlargest(num, enumerate(variances), key=lambda x: x[1])]
    
    def coocVariances(self, term, num, *args):
        allIn = lambda term: all((arg.hasItem(term) for arg in args))
        termList = [term for term in self.index if allIn(term)]
        selections = [emb.getIndices(termList) for emb in args]
        log=False
        context_lists = [emb.getContexts(term, log)[emb.getIndices(termList)] for emb in args] + \
                    [self.getContexts(term, log)[self.getIndices(termList)]]
        variances = np.array(context_lists).var(axis=0)
        
        max_variances_indices = [i for i, var in nlargest(num, enumerate(variances), key=lambda x: x[1])]
        lists = []
        lists.append([termList[i] for i in max_variances_indices])
        lists.append([variances[i] for i in max_variances_indices])
        for context_list in context_lists:
            lists.append([context_list[i] for i in max_variances_indices])
        return [element for element in zip(*lists)]

    def getAbstraction(self, *terms):
        #indices = [self.index[term] for term in terms]
        #term_vecs = self.vecs[indices,]
        #centroid = np.average(term_vecs, axis=0)
        #closest_index = distance.cdist(self.vecs, [centroid], metric='cosine').argmin()
        #return self.terms[closest_index]
        return None

    def hasItem(self, item):
        return item in self.index

    def getFilePath(self):
        return self.root_filename
