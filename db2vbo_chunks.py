#!/usr/bin/env python

import sqlite3
import gzip
import array
import json
import math
import sys
import os

pointsFields = ['x','y','z','r','g','b','tmin','tmax']
camerasFields = ['f','k1','k2','R11','R12','R13','R21','R22','R23','R31','R32','R33','t1','t2','t3','fovy','aspect']

if len(sys.argv) != 3:
  print 'Usage: python %s <db_filename> <chunk_size>' % sys.argv[0]
  sys.exit(-1)

db = sys.argv[1] # 'times-square-v7.db'
chunkSize = int(sys.argv[2])

class Timer:
  def __enter__(self):
    self.elapsed = time.time()

  def __exit__(self, type, value, traceback):
    self.elapsed = time.time() - self.elapsed
    print 'time elapsed %.3f s' % self.elapsed

def rowsToBytes(rows):
  data = [col for cols in rows for col in cols]
  bytes = array.array('f', data)
  return bytes.tostring()

def colorRowsToBytes(rows):
  data = []
  for cols in rows:
    val = 0.0
    i = 2
    for col in cols:
      val += math.pow(2, 8*i)*col
      i -= 1
    data.append(val)
    
  bytes = array.array('f', data)
  return bytes.tostring()

def writeChunk(filename, start, num):
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

    with gzip.open(filename, 'wb') as wf:
      wf.write(pos_bytes+color_bytes+t_bytes+sources+idxs)
  finally:
    conn.close()

def getPtCount():
  conn = sqlite3.connect(db)
  ptCount = 0
  try:
    c = conn.cursor()
    rows = c.execute('select count(idx) from points')
    for row in rows:
      ptCount = row[0]
  finally:
    conn.close()
  return ptCount

def prepareInfo():
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
    chunkCount = int(math.ceil(float(ptCount)/float(chunkSize)))

    with open(db + '_info', 'w') as wf:
      json.dump(
          { 'sources': sources,
            'tmin': tmin,
            'tmax': tmax,
            'camCount': camCount,
            'ptCount': ptCount,
            'chunkCount': chunkCount,
            'chunkSize': chunkSize }, wf, indent=2)
  finally:
    conn.close()
  print 'done loading db info'

if __name__ == '__main__':
  prepareInfo()
  ptCount = getPtCount()
  print 'total %d points' % ptCount
  curChunk = 0
  totalChunks = int(math.ceil(float(ptCount) / float(chunkSize)))
  for i in xrange(0, ptCount, chunkSize):
    filename = db.split('.')[0]+'.part_'+str(curChunk)+'.gz'
    print ' start writing out chunk (%d/%d) starting at %d to %s' % (curChunk+1, totalChunks, i, filename)
    writeChunk(filename, i, chunkSize)
    curChunk += 1
  print 'done with %d chunks!' % curChunk
