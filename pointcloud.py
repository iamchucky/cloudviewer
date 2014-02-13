#!/usr/bin/env python

import logging
import sqlite3
import math
import msgpack
import array
import time
import json
import sys
import os
from flask import Flask, jsonify, Response, render_template, request
app = Flask(__name__)

pointsFields = ['x','y','z','r','g','b','tmin','tmax']
camerasFields = ['f','k1','k2','R11','R12','R13','R21','R22','R23','R31','R32','R33','t1','t2','t3','fovy','aspect']

db = 'times-square-v7.db'

class Timer:
  def __enter__(self):
    self.elapsed = time.time()

  def __exit__(self, type, value, traceback):
    self.elapsed = time.time() - self.elapsed
    print 'time elapsed %.3f s' % self.elapsed

def pointToJson(pt):
  jsonPt = {}
  for i in xrange(len(pt)):
    val = pt[i] if not math.isnan(pt[i]) else None
    jsonPt[pointsFields[i]] = val 
  return jsonPt

def cameraToJson(camera):
  jsonCamera = {}
  for i in xrange(len(camera)):
    val = camera[i] if not math.isnan(camera[i]) else None
    jsonCamera[camerasFields[i]] = val
  return jsonCamera

def rowsToBytes(rows):
  data = [col for cols in rows for col in cols]
  bytes = array.array('f', data)
  return bytes.tostring()

@app.route('/api/getCamera')
def getCamera():
  start = request.args.get('start', 0, type=int)
  num = request.args.get('num', 20, type=int)
  conn = sqlite3.connect(db)
  try:
    c = conn.cursor()
    rows = c.execute('select '+','.join(camerasFields)+' from cameras limit '+str(start)+','+str(num))
    cameras = [cameraToJson(row) for row in rows]
    return jsonify({'cameras':cameras})
  finally:
    conn.close()

@app.route('/api/getPt')
def getPt():
  start = request.args.get('start', 0, type=int)
  num = request.args.get('num', 20, type=int)

  conn = sqlite3.connect(db)

  try:
    c = conn.cursor()
    rows = c.execute('select x,y,z from points limit '+str(start)+','+str(num))
    pos_bytes = rowsToBytes(rows)
    rows = c.execute('select r/255.0,g/255.0,b/255.0 from points limit '+str(start)+','+str(num))
    color_bytes = rowsToBytes(rows)
    rows = c.execute('select tmin,tmax from points limit '+str(start)+','+str(num))
    t_bytes = rowsToBytes(rows)
    rows = c.execute('select source from points limit '+str(start)+','+str(num))
    sources = rowsToBytes(rows)
    # idx based on the row index in the db
    rows = c.execute('select rowid from points limit '+str(start)+','+str(num))
    idxs = rowsToBytes(rows)

    return Response(pos_bytes+color_bytes+t_bytes+sources+idxs, mimetype='application/octet-stream')
  finally:
    conn.close()

@app.route('/api/getPtChunk')
def getPtChunk():
  chunkId = request.args.get('id', 0, type=int)
  try:
    with open(db.split('.')[0]+'.part_'+str(chunkId)+'.gz', 'rb') as rf:
      content = rf.read()
      resp = Response(content, mimetype='application/octet-stream')
      resp.headers['Content-Encoding'] = 'gzip'
      return resp
  except:
    return

@app.route('/api/getInfo')
def getInfo():
  with open(db + '_info', 'r') as rf:
    info = json.load(rf)
    return jsonify(info)

@app.route('/api/getPtColors')
def getPtColors():
  start = request.args.get('start', 0, type=int)
  num = request.args.get('num', 20, type=int)
  conn = sqlite3.connect(db)

  try:
    c = conn.cursor()
    rows = c.execute('select r,g,b from points limit '+str(start)+','+str(num))
    bytes = rowsToBytes(rows)
    return Response(bytes, mimetype='application/octet-stream')
  finally:
    conn.close()

@app.route('/api/getPt.json')
def getPtJson():
  start = request.args.get('start', 0, type=int)
  num = request.args.get('num', 20, type=int)
  conn = sqlite3.connect(db)

  try:
    c = conn.cursor()
    rows = c.execute('select '+','.join(pointsFields)+' from points limit '+str(start)+','+str(num))
    pts = [pointToJson(row) for row in rows]
    return jsonify({'points':pts})
  finally:
    conn.close()

@app.route('/api/getPtFromRowId')
def getPtFromRowId():
  rowid = request.args.get('rowid', 0, type=int)
  conn = sqlite3.connect(db)

  try:
    c = conn.cursor()
    rows = c.execute('select '+','.join(pointsFields)+' from points where rowid = '+str(rowid))
    pts = [pointToJson(row) for row in rows]
    return jsonify({'points':pts})
  finally:
    conn.close()

@app.route('/')
def index():
  return render_template('index.html')

@app.route('/camera')
def cameraTest():
  return render_template('camera.html')

logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)

if __name__ == '__main__':
  if not os.path.exists(db + '_info'):
    print '%s_info does not exist, please run db2vbo_chunk.py' % db
    sys.exit(-1)
  app.run(debug=True)
