#!/bin/env python

from flask import Flask, jsonify, request, send_from_directory, abort
from embedding_sharedmem import Embedding
import json, os, ast, pickle, sys
from pathlib import Path
import numpy as np

data = None
embeddings = {}
wordlists = {}

data_path = Path(__file__).resolve().parent.parent / 'data'
print('data path: ' + str(data_path))

stopwords = { }
if (data_path / 'stopwords.txt').exists():
    print("loading stopwords from " + str(data_path / 'stopwords.txt'))
    stopwords = set((line.strip() for line in (data_path / 'stopwords.txt').open()))
else:
    print("no file stopwords.txt in " + str(data_path))

if len(sys.argv) > 1 and sys.argv[1] == 'demo':
    print("RUNNING IN LOCAL DEMO MODE!!")
    p = Path(__file__).resolve().parent / 'static'
    print("static folder: " + str(p))
    app = Flask(__name__, static_folder=str(p))

    #read embeddings
    embeddings_path = data_path / 'embeddings'
    for f in (f.name for f in embeddings_path.iterdir() if f.name.endswith('_vecs.npy')):
        embeddings[f[:-9]] = Embedding(str(embeddings_path / f[:-9]), stopwords)

    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    @app.route('/test')
    def test():
        return 'DEMO MODE!!'

    @app.route('/s/<path:path>')
    def send_file(path):
        print(path)
        return app.send_static_file(path)
elif len(sys.argv) > 1 and sys.argv[1] == 'preload':
    print("preloading embeddings")
    #read embeddings
    embeddings_path = data_path / 'embeddings'
    for f in (f.name for f in embeddings_path.iterdir() if f.name.endswith('_vecs.npy')):
        embeddings[f[:-9]] = Embedding(str(embeddings_path / f[:-9]), stopwords, preload = True)
    sys.exit(0)
else:
    app = Flask(__name__)

@app.route('/neighbors_get_data', methods=['POST'])
def neighbors_get_data():
    json = request.get_json()
    allNeighbors = set()
    response = []
    single_sets = []
    terms = set()
    for conf in json:
        nn = embeddings[conf['embedding']].getNN(conf['term'], number=conf['numneighbors'])
        response += [(conf['id'], n, dist, True) for n, dist in nn]
        this_set = set()
        this_set.add(conf['term'])
        for term, dist in nn:
            allNeighbors.add(term)
            this_set.add(term)
        single_sets.append(this_set)
    for conf, resplist, termset in zip(json, response, single_sets):
        additional_neighbors = embeddings[conf['embedding']].getSims(conf['term'], (allNeighbors-termset))
        response += [(conf['id'], n, dist, False) for n, dist in additional_neighbors]

    #add rank numbers
    response.sort(key=lambda x: x[2], reverse=True)
    ranked_response = []
    counts = {}
    for conf in json:
        counts[conf['id']] = 1
    for ident, term, dist, nn in response:
        ranked_response.append((ident, term, dist, nn, counts[ident]))
        if counts[ident] == 0: print(term)
        counts[ident] += 1

    stats = {}
    for emb, num in ((conf["embedding"], conf['numneighbors']) for conf in json):
        stats[emb] = embeddings[emb].getNeighborStats(num)
    resp = {'stats' : stats, 'neighbors': ranked_response}
    return jsonify(resp)

@app.route('/neighbors_directions', methods=['post'])
def neighbors_directions():
    return None

@app.route('/neighbors_signal', methods=['POST'])
def neighbors_signal():
    json = request.get_json()
    #print('signal: ' + json)
    return ('', 204)

@app.route('/get_ui_data')
def get_ui_data():
    data = {}
    data['wordlists'] = [key for key in wordlists]
    data['wordlists'].sort()
    data['embeddings'] = [{'name' : emb, 'has_context': embeddings[emb].hasContext()} for emb in embeddings]
    resp = jsonify(data)
    return resp

@app.route('/annotate_tree', methods=['POST'])
def get_abstraction():
    print('starting tree abstraction')
    data = request.get_json()
    visit(data['tree'], embeddings[data['emb']])
    print('done')
    return jsonify(data['tree'])

def visit(node, emb):
    if node != None:
        if isinstance(node, dict) and '_root' in node:
            #get the root node first
            return visit(node['_root'], emb)
        elif isinstance(node, dict):
            #leaf node
            return [node['data'][0]]
        elif isinstance(node, list):
            #non leaf node
            wordlist = []
            for i in range(4):
                wordlist += visit(node[i], emb)
            absTerm = emb.getAbstraction(*wordlist)
            #print('abstraction of ' + str(wordlist) + ' is ' + str(absTerm))
            node.append([ wordlist, absTerm ])
            return wordlist
    return []

@app.route('/exists', methods=['POST'])
def exists():
    json = request.get_json()
    emb = embeddings[json['emb']]
    term = json['term']
    return jsonify(emb.hasItem(term))

@app.route('/projections_get_data', methods=['POST'])
def projections_get_data():
    json = request.get_json()
    wordlist = [word for word in wordlists[json['wordlist']] if (embeddings[json['xembedding']].hasItem(word) and embeddings[json['yembedding']].hasItem(word))]
    xterm1, xterm2 = [term.strip() for term in json['xdimension'].split('-')]
    yterm1, yterm2 = [term.strip() for term in json['ydimension'].split('-')]
    mappingx = embeddings[json['xembedding']].smashOnLine(xterm1, xterm2, wordlist)
    mappingy = embeddings[json['yembedding']].smashOnLine(yterm1, yterm2, wordlist)
    dictx = dict(mappingx)
    dicty = dict(mappingy)
    labelx = json['xdimension'] + ' (' + json['xembedding'] + ')'
    labely = json['ydimension'] + ' (' + json['yembedding'] + ')'
    resp = jsonify((labelx, labely, [(term, dictx[term], dicty[term]) for term in wordlist]))
    return resp

@app.route('/coocs_get_data', methods=['POST'])
def coocs_get_data():
    json = request.get_json()
    embs = json['embeddings']
    terms = json['terms']
    coocs = json['coocs']
    high_vars = [embeddings[emb].coocVariancesTerm(20, *terms) for emb in embs]
    #store variances
    variances = {}
    num_variances = {}
    #add user chosen coocs to all terms
    all_terms = set(coocs)
    term_sets = {}
    for l, emb in zip(high_vars, embs):
        new_set = set()
        for t in l:
            if t[0] in variances:
                variances[t[0]] += t[1]
            else:
                variances[t[0]] = t[1]
            if t[0] in num_variances:
                num_variances[t[0]] += 1
            else:
                num_variances[t[0]] = 1
            all_terms.add(t[0])
            new_set.add(t[0])
        term_sets[emb] = new_set
    #average variances
    for term in variances:
        variances[term] /= num_variances[term]
    all_terms_list = sorted(list(all_terms), key=lambda x: variances[x] if x in variances else 0, reverse=True)
    results = {}
    for emb_name in embs:
        lines = []
        for selected_term in terms:
            #lines.append([(variance_term in term_sets[emb_name], embeddings[emb_name].getContextCount(selected_term, variance_term), selected_term, variance_term, emb_name) for variance_term in all_terms_list])
            lines.append([(variance_term in term_sets[emb_name], embeddings[emb_name].getContextProp(selected_term, variance_term), selected_term, variance_term, emb_name) for variance_term in all_terms_list])
        results[emb_name] = lines
    return jsonify((embs, terms, all_terms_list, results))

@app.before_first_request
def setup():
    if not embeddings:
        #read embeddings
        embeddings_path = data_path / 'embeddings'
        for f in (f.name for f in embeddings_path.iterdir() if f.name.endswith('_vecs.npy')):
            embeddings[f[:-9]] = Embedding(str(embeddings_path / f[:-9]), stopwords)
    #read wordlists
    wordlists_path = data_path / 'wordlists'
    for f in wordlists_path.iterdir():
        if f.name.endswith('.txt'):
            with f.open() as infile:
                wordlists[f.name[:-4]] = [word.strip() for word in infile]

if __name__ == '__main__':
    app.run('0.0.0.0')
