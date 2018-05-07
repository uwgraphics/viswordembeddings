import os, math, copy, random, string
import numpy as np
from scipy.spatial import distance
from scipy.stats import variation
from heapq import nsmallest, nlargest
import sharearray

pass_filter = lambda x: not x in stopwords

def strip_filename(filename):
    afterslash = filename.split('/')[-1]
    beforedot = afterslash.split('.')[:-1]
    return '.'.join(beforedot)

def getListArithmetic(inputString, symb = '+'):
    splitPlus = inputString.split(symb)
    if (len(splitPlus) == 1) and (not '-' in splitPlus[0]):
        return [splitPlus[0].strip()]
    new_list = []
    for el in splitPlus:
        el.strip()
        new_list += getListArithmetic(el, symb = '-')
        new_list.append(symb)
    return new_list[:-1]

class Embedding(object):

    def __del__(self):
        if hasattr(self, 'ident'): # otherwise we are preloading
            others = len([f for f in os.listdir('/tmp/') if f.startswith(self.ident)])
            os.remove('/tmp/' + self.ident + self.rand_ident)
            if others == 1:
                sharearray.free(strip_filename(self.terms_filename))
                sharearray.free(strip_filename(self.vecs_filename))
                if (self.has_stats):
                    sharearray.free(strip_filename(self.stats_filename))
                if (self.context):
                    sharearray.free(strip_filename(self.cvecs_filename))
                    sharearray.free(strip_filename(self.biases_filename))
                    sharearray.free(strip_filename(self.cbiases_filename))

    def __init__(self, root_filename, stopwords = set(), preload = False):
        print('root filename: ' + root_filename)

        if not preload:
            self.ident = root_filename.split('/')[-1].replace('.', '_')
            self.rand_ident = ''.join([random.choice(string.ascii_letters) for n in range(10)])
            open('/tmp/' + self.ident + self.rand_ident, 'w').close()

        self.stopwords = stopwords
        self.root_filename = root_filename
        self.terms_filename = root_filename + '_terms.npy'
        self.vecs_filename = root_filename + '_vecs.npy'
        self.cvecs_filename = root_filename + '_cvecs.npy'
        self.biases_filename = root_filename + '_biases.npy'
        self.cbiases_filename = root_filename + '_cbiases.npy'
        self.stats_filename = root_filename + '_stats.npy'
        self.has_stats = os.path.isfile(self.stats_filename)
        self.context = os.path.isfile(self.cvecs_filename)
        #read stuff
        self.terms = sharearray.cache(strip_filename(self.terms_filename), lambda: np.load(self.terms_filename))
        self.index = dict(((term, index) for index, term in enumerate(self.terms)))
        self.vecs = sharearray.cache(strip_filename(self.vecs_filename), lambda: np.load(self.vecs_filename))
        if (self.has_stats):
            self.stats = sharearray.cache(strip_filename(self.stats_filename), lambda: np.load(self.stats_filename))
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

    def handleArithmetic(self, terms):
        termList = getListArithmetic(terms)
        numTerms = (len(termList) // 2) + 1
        vec = np.copy(self.vecs[self.index[termList.pop(0)]])
        while (len(termList)):
            plusOrMinus = termList.pop(0)
            newEl = self.vecs[self.index[termList.pop(0)]]
            if plusOrMinus == '+':
                vec += newEl
            elif plusOrMinus == '-':
                vec -= newEl
        norm = np.linalg.norm(vec)
        if norm > 0.0:
            return (vec / norm, numTerms)
        else:
            return (vec, numTerms)

    def getSims(self, term, terms):
        #vec = self.vecs[self.index[term]]
        vec, numTerms = self.handleArithmetic(term)
        index_list = [self.index[t] for t in terms if t in self.index]
        reduced_array = self.vecs[index_list,:]
        gen = enumerate((x[0] for x in distance.cdist(reduced_array, [vec], metric='cosine')))
        return [(self.terms[index_list[i]], ((1-dist)+1)/2) for i, dist in gen]

    def getNN(self, terms, number=10):
        #vec = self.vecs[self.index[term]]
        vec, numTerms = self.handleArithmetic(terms)
        gen = enumerate((x[0] for x in distance.cdist(self.vecs, [vec], metric='cosine')))
        res = [(self.terms[i], ((1-dist)+1)/2) for i, dist in nsmallest(number + 1, gen, key=lambda x:x[1])]
        if numTerms > 1:
            return res[:-1]
        else:
            #the nearest neighbor is the terms itself
            return res[1:]

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

    def getContexts(self, term):
        if (not self.hasContext()):
            raise Exception('This embedding does not contain context vectors!')

        term_id = self.index[term]
        log_coocs = (self.vecs[term_id] * self.cvecs).sum(axis=1) + self.biases[term_id] - self.cbiases
        coocs = np.exp(log_coocs)
        coocs = coocs / np.linalg.norm(coocs)
        return coocs

    def getContextCount(self, term, context_term):
        if (not self.hasContext()):
            raise Exception('This embedding does not contain context vectors!')
        term_id = self.index[term]
        context_id = self.index[context_term]
        log_val = np.dot(self.vecs[term_id], self.cvecs[context_id]) + self.biases[term_id] - self.cbiases[context_id] + self.biases[term_id]
        return np.exp(log_val)

    def getContextProp(self, term, context_term):
        if (not self.hasContext()):
            raise Exception('This embedding does not contain context vectors!')

        contexts = self.getContexts(term)
        #term_id = self.index[term]
        context_id = self.index[context_term]
        #log_val = np.dot(self.vecs[term_id], self.cvecs[context_id]) + self.biases[term_id] - self.cbiases[context_id] + self.biases[term_id]
        #return np.exp(log_val)
        return contexts[context_id]

    def getIndices(self, termList):
        return [self.index[term] for term in termList]

    def coocVariancesTerm(self, num, *terms):
        context_lists = [self.getContexts(term) for term in terms]
        context_matrix = np.array(context_lists)
        variances = context_matrix.var(axis=0)
        #variances = variation(context_matrix, axis=0)
        #print([val[0] for val in context_lists])
        #print(context_matrix[:,0])
        #print(variances[0])
        #print(np.var(context_matrix[:,0]))
        #use stopword list
        keep_out = lambda x: (self.terms[x] in self.stopwords) or (self.terms[x] in terms)
        filter_mask = np.array([int(not keep_out(i)) for i in range(len(variances))])
        variances = variances * filter_mask
        results = [(self.terms[i], var) for i, var in nlargest(num, enumerate(variances), key=lambda x: x[1])]
        print("nlargest coocs:")
        print(results)
        return results

    def getAbstraction(self, *terms):
        indices = [self.index[term] for term in terms]
        term_vecs = self.vecs[indices,]
        centroid = np.average(term_vecs, axis=0)
        distances = distance.cdist(term_vecs, [centroid], metric='cosine')
        closest_index = distances.argmin()
        average_distance = distances.mean()
        return (terms[closest_index], average_distance)

    def getNeighborStats(self, numneighbors):
        if (self.has_stats):
            stats = self.stats[numneighbors - 1]
            return stats.tolist()
        else:
            return None

    def hasItem(self, item):
        terms = getListArithmetic(item)
        for term in terms:
            if term in ['+', '-']:
                continue
            if not term in self.index:
                return False
        return True

    def getFilePath(self):
        return self.root_filename
