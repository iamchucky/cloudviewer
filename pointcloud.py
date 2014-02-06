#!/usr/bin/env python

import logging
import sqlite3
import math
import msgpack
import gzip
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
    idxs = array.array('f', xrange(start, start+num)).tostring()
    return Response(pos_bytes+color_bytes+t_bytes+sources+idxs, mimetype='application/octet-stream')
  finally:
    conn.close()

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

@app.route('/')
def index():
  return render_template('index.html')

@app.route('/camera')
def cameraTest():
  return render_template('camera.html')

logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)

def prepareInfo():
  if os.path.exists(db + '_info'):
    return

  print 'preparing db info...'
  conn = sqlite3.connect(db)
  try:
    c = conn.cursor()
    rows = c.execute('select min(tmin) from points')
    tmin = 0
    for row in rows:
      tmin = row[0]
    rows = c.execute('select max(tmax) from points')
    tmax = 0
    for row in rows:
      tmax = row[0]
    rows = c.execute('select distinct source from points')
    sources = []
    for row in rows:
      sources.append(row)
    rows = c.execute('select count(f) from cameras')
    for row in rows:
      camCount = row[0]
    rows = c.execute('select count(idx) from points')
    for row in rows:
      ptCount = row[0]
    with open(db + '_info', 'w') as wf:
      json.dump(
          { 'sources': sources,
            'tmin': tmin,
            'tmax': tmax,
            'camCount': camCount,
            'ptCount': ptCount }, wf, indent=2)
  finally:
    conn.close()
  print 'done loading db info'

if __name__ == '__main__':
  prepareInfo()
  app.run(debug=True)
