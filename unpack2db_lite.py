import sys
import sqlite3
import gzip
import msgpack
import numpy
import json
import random
from math import isnan

if len(sys.argv) != 3:
  print 'Usage: python %s <db_msgpack_filename> <db_filename>' % sys.argv[0]
  sys.exit(-1)

pack_file = sys.argv[1]
db = sys.argv[2]
conn = sqlite3.connect(db)
db_data = None

def createDb():
  conn.execute('create table if not exists points(' +
      'x real not null,' +
      'y real not null,' +
      'z real not null,' +
      'r integer not null,' +
      'g integer not null,' +
      'b integer not null,' +
      'idx integer not null primary key)')
  conn.execute('create table if not exists cameras(' +
      'f real not null,' +
      'k1 real not null,' +
      'k2 real not null,' +
      'R11 real not null,' +
      'R12 real not null,' +
      'R13 real not null,' +
      'R21 real not null,' +
      'R22 real not null,' +
      'R23 real not null,' +
      'R31 real not null,' +
      'R32 real not null,' +
      'R33 real not null,' +
      't1 real not null,' +
      't2 real not null,' +
      't3 real not null,' + 
      'fovy real not null,' + 
      'aspect real not null)')
  conn.commit()

def filterNone(objs):
  return [obj for obj in objs if None not in obj and not (type(obj) is float and len(filter(isnan, obj)) > 0)]

def loadPoints():
  global db_data
  with open(pack_file, 'rb') as f:
    db_data = msgpack.unpackb(f.read())

def migrate():
  global db_data
# cameras
  cameras = filterNone(db_data['cameras']['attributes'])
  print '%d cameras' % len(cameras)
  conn.executemany("insert into cameras (f,k1,k2,R11,R12,R13,R21,R22,R23,R31,R32,R33,t1,t2,t3,fovy,aspect) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", cameras)
  cameras = None
  db_data['cameras'] = None

# points
  points = filterNone([x[:6]+x[12:]+x[9:11] for x in db_data['points']['attributes']])
  points = [p[:7] for p in points]
  print '%d points' % len(points)
  conn.executemany("insert into points (x,y,z,r,g,b,idx) values (?,?,?,?,?,?,?)", points)
  points = None
  db_data['points'] = None
# commit
  conn.commit()

def main():
  loadPoints()
  createDb()
  migrate()

if __name__ == '__main__':
  main()
