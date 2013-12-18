#!/usr/bin/env python

import logging
import sqlite3
import math
import msgpack
import gzip
import array
from flask import Flask, jsonify, Response, render_template, request
app = Flask(__name__)

fields = ['x', 'y', 'z', 'r', 'g', 'b', 'tmin', 'tmax']

db = 'times-square-v5.db'

def pointToJson(pt):
	jsonPt = {}
	for i in xrange(len(pt)):
		val = pt[i] if not math.isnan(pt[i]) else None
		jsonPt[fields[i]] = val 
	return jsonPt

def rowsToBytes(rows):
	data = [col for cols in rows for col in cols]
	bytes = array.array('f', data)
	return bytes.tostring()

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
		return Response(pos_bytes+color_bytes+t_bytes+sources, mimetype='application/octet-stream')
	finally:
		conn.close()

@app.route('/api/getInfo')
def getInfo():
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
		return jsonify({'sources':sources, 'tmin':tmin, 'tmax':tmax})
	finally:
		conn.close()

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
		rows = c.execute('select '+','.join(fields)+' from points limit '+str(start)+','+str(num))
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
	app.run(debug=True)
