import sys
import sqlite3
import gzip
import msgpack
import numpy
import json
import random
from math import isnan

if len(sys.argv) != 4:
  print 'Usage: python %s <db_msgpack_filename> <camera_urls_filename> <db_filename>' % sys.argv[0]
  sys.exit(-1)

pack_file = sys.argv[1]
camera_urls_pack_file = sys.argv[2]
db = sys.argv[3]
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
      'clusterid integer not null,' +
      'clustercolor integer not null,' +
      'interval_str blob not null,' +
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
  conn.execute('create table if not exists camera_urls(' +
      'camid integer not null primary key,' +
      'url text not null)')
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

  # load camera_urls
  if camera_urls_pack_file != 'none':
    camera_urls = [row for row in msgpack.Unpacker(gzip.GzipFile('urls.gz', 'rb'))]
    print '%d camera urls' % len(camera_urls)
    conn.executemany('insert into camera_urls (camid, url) values (?,?)', camera_urls)

# points
  time_dict = {}
  for d in db_data['time-intervals']:
    time_dict[d[0]] = buffer(d[1])
  print '%d points time_intervals' % len(time_dict)

  ticks_dict = {}
  if 'events' in db_data:
    for d in db_data['events']:
      ticks_dict[d[0]] = [buffer(d[1]), buffer(d[2]), buffer(d[3])]
    print '%d points events' % len(ticks_dict)

  clustercolor = {}
  for x in db_data['points']['attributes']:
    if 0 not in clustercolor:
      clustercolor[0] = random.randint(0, 16777215)

                                            #cluster info       #time intervals    #ticks info
  #points = filterNone([x[:6]+x[9:11]+x[12:]+[0, clustercolor[0]]+[time_dict[x[-1]]]+ticks_dict[x[-1]] for x in db_data['points']['attributes']])
  points = filterNone([x[:6]+x[9:11]+x[12:]+[0, clustercolor[0]]+[time_dict[x[-1]]] for x in db_data['points']['attributes']])
  print '%d points' % len(points)
  conn.executemany("insert into points (x,y,z,r,g,b,tmin,tmax,idx,clusterid,clustercolor,interval_str) values (?,?,?,?,?,?,?,?,?,?,?,?)", points)
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
