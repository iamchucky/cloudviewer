#!/usr/bin/env python

from datetime import date
import logging
import sqlite3
import math
import msgpack
import numpy
import array
import time
import json
import sys
import os
from flask import Flask, jsonify, Response, render_template, request
app = Flask(__name__)

pointsFields = ['x','y','z','r','g','b','tmin','tmax','idx']
camerasFields = ['f','k1','k2','R11','R12','R13','R21','R22','R23','R31','R32','R33','t1','t2','t3','fovy','aspect']

available_dataset = ['5pointz6']
default_dataset = available_dataset[0]

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

def prepareTimeIntervals(rows, info):
  data_str = ''
  times = {
    'cols': [
      { 'id':'', 'label':'PointID', 'pattern':'', 'type':'string' },
      { 'id':'', 'label':'Start', 'pattern':'', 'type':'date' },
      { 'id':'', 'label':'End', 'pattern':'', 'type':'date' }
    ],
    'rows': []
  }
  num_rows = 0
  tmax = info['tmax']
  tmin = info['tmin']
  for r in rows:
    num_rows += 1
    idx = r[0]
    point_tmin = r[1]
    point_tmax = r[2]
    data_str = r[3]
    data = numpy.fromstring(data_str, dtype=numpy.float32).reshape((-1,2))
    for d in data:
      if d[0] < tmin or d[1] < tmin or d[0] > tmax or d[1] > tmax:
        continue
      start_d = date.fromtimestamp(d[0])
      end_d = date.fromtimestamp(d[1])
      start = 'Date(%s)' % str(start_d).replace('-',', ')
      end = 'Date(%s)' % str(end_d).replace('-',', ')

      # json data input 
      # https://developers.google.com/chart/interactive/docs/reference#dataparam
      #
      # col: [{val: <pointid>}, {val: <start>}, {val: <end>}]
      times['rows'].append({
        'c':[{'v':str(idx)}, {'v':start}, {'v':end}]
      })
    num_rows += 1
    start_d = date.fromtimestamp(point_tmin)
    end_d = date.fromtimestamp(point_tmax)
    start = 'Date(%s)' % str(start_d).replace('-',', ')
    end = 'Date(%s)' % str(end_d).replace('-',', ')
    times['rows'].append({
      'c':[{'v':'estimated'}, {'v':start}, {'v':end}]
    })
    num_rows += 1
  return times, num_rows 

@app.route('/api/getCamera')
def getCamera():
  start = request.args.get('start', 0, type=int)
  num = request.args.get('num', 20, type=int)
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  conn = sqlite3.connect(dataset+'.db')
  try:
    c = conn.cursor()
    rows = c.execute('select '+','.join(camerasFields)+' from cameras limit '+str(start)+','+str(num))
    cameras = [cameraToJson(row) for row in rows]
    return jsonify({'cameras':cameras})
  finally:
    conn.close()

@app.route('/api/getPtChunk')
def getPtChunk():
  chunkId = request.args.get('id', 0, type=int)
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  try:
    with open(dataset+'.part_'+str(chunkId)+'.gz', 'rb') as rf:
      content = rf.read()
      resp = Response(content, mimetype='application/octet-stream')
      resp.headers['Content-Encoding'] = 'gzip'
      return resp
  except:
    return

@app.route('/api/getInfo')
def getInfo():
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  with open(dataset + '.db_info', 'r') as rf:
    info = json.load(rf)
    return jsonify(info)

@app.route('/api/getPtColors')
def getPtColors():
  start = request.args.get('start', 0, type=int)
  num = request.args.get('num', 20, type=int)
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  conn = sqlite3.connect(dataset+'.db')

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
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  conn = sqlite3.connect(dataset+'.db')

  try:
    c = conn.cursor()
    rows = c.execute('select '+','.join(pointsFields)+' from points limit '+str(start)+','+str(num))
    pts = [pointToJson(row) for row in rows]
    return jsonify({'points':pts})
  finally:
    conn.close()

@app.route('/api/getPtFromIdx')
def getPtFromIdx():
  idx = request.args.get('idx', 0, type=int)
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  with open(dataset + '.db_info', 'r') as rf:
    info = json.load(rf)
  conn = sqlite3.connect(dataset+'.db')

  try:
    c = conn.cursor()
    rows = c.execute('select '+','.join(pointsFields)+' from points where idx = '+str(idx))
    pts = [pointToJson(row) for row in rows]
    rows = c.execute('select idx,tmin,tmax,interval_str from points where idx = '+str(idx))
    times, num_rows = prepareTimeIntervals(rows, info)
    return jsonify({'points': pts, 'time_intervals': times, 'num_rows': num_rows})
  finally:
    conn.close()

@app.route('/')
def index():
  dataset = request.args.get('dataset', default_dataset, type=str)
  if dataset not in available_dataset:
    dataset = default_dataset
  return render_template('index.html', dataset=dataset)

@app.route('/camera')
def cameraTest():
  return render_template('camera.html')

logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)

if __name__ == '__main__':
  for dataset in available_dataset:
    if not os.path.exists(dataset + '.db_info'):
      print '%s.db_info does not exist, please run db2vbo_chunk.py' % dataset
      sys.exit(-1)
  app.run(debug=True)
