import sys
import sqlite3
import msgpack
import numpy
import json
from math import isnan

if len(sys.argv) != 4:
  print 'Usage: python %s <msgpack_filename> <db_filename> <has_time_intervals(0:1)>' % sys.argv[0]
  sys.exit(-1)

pack_file = sys.argv[1]
db = sys.argv[2]
has_time_intervals = sys.argv[3] > 0
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
      'nx integer,' +
      'ny integer,' +
      'nz integer,' +
      'tmin integer not null,' +
      'tmax integer not null,' +
      'source integer not null,' +
      'idx integer not null)')
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
  if has_time_intervals:
    conn.execute('create table if not exists time_intervals(' +
        'point_idx integer not null,' +
        'interval_str blob not null)')
  conn.commit()

def filterNone(objs):
  return [obj for obj in objs if None not in obj and len(filter(isnan, obj)) == 0]

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
# points
  points = filterNone([x[:6]+x[9:] for x in db_data['points']['attributes']])
  print '%d points' % len(points)
  conn.executemany("insert into points (x,y,z,r,g,b,tmin,tmax,source,idx) values (?,?,?,?,?,?,?,?,?,?)", points)
# commit
  conn.commit()

  if has_time_intervals:
    # free cameras and points
    cameras = None
    points = None
    db_data['points'] = None
    db_data['cameras'] = None
    # time_intervals
    time_intervals = [[d[0], buffer(d[1])] for d in db_data['time-intervals']]
    print '%d points time_intervals' % len(time_intervals)
    conn.executemany("insert into time_intervals (point_idx, interval_str) values (?,?)", time_intervals)
    # commit
    conn.commit()

def main():
  loadPoints()
  createDb()
  migrate()

if __name__ == '__main__':
  main()
