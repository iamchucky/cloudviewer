import sys
import sqlite3
import gzip
import msgpack
import numpy
import json
import random
from math import isnan

if len(sys.argv) != 4:
  print 'Usage: python %s <time_observation_filename> <url_gz_filename> <db_filename>' % sys.argv[0]
  sys.exit(-1)

pack_file = sys.argv[1]
url_pack_file = sys.argv[2]
db = sys.argv[3]
conn = sqlite3.connect(db)

def createDb():
  conn.execute('create table if not exists observations(' +
      'neg_rowid_pack blob not null,' +
      'pos_rowid_pack blob not null,' +
      'point_idx integer not null)')
  conn.execute('create table if not exists cameras(' +
      'timestamp integer not null,' +
      'flickrid text not null unique,' +
      'url text not null,' +
      'rowid integer not null primary key)')
  conn.commit()

def filterNone(objs):
  return [obj for obj in objs if None not in obj and not (type(obj) is float and len(filter(isnan, obj)) > 0)]

def migrate():
  camera_urls = {}
  for flickrid, url in msgpack.Unpacker(gzip.GzipFile(url_pack_file, 'rb')):
    flickrid = str(flickrid)
    if flickrid not in camera_urls:
      camera_urls[flickrid] = url
  print 'loaded %d camera urls' % len(camera_urls)

  camera_ts_dict = {}
  observations = [] 
  count = 0
  with open(pack_file, 'rb') as rf:
    for r in msgpack.Unpacker(rf):
      pobs = []
      nobs = []
      # positive camera ids
      pcamids = numpy.fromstring(r[2], dtype=numpy.uint64)
      pcamts = numpy.fromstring(r[1], dtype=numpy.float32)
      for i in xrange(0, len(pcamids)):
        camid = pcamids[i]
        if camid not in camera_ts_dict:
          rowid = len(camera_ts_dict)
          camera_ts_dict[camid] = [rowid, pcamts[i]]
          pobs.append(rowid)
        else:
          pobs.append(camera_ts_dict[camid][0])

      # negative camera ids
      ncamids = numpy.fromstring(r[4], dtype=numpy.uint64)
      ncamts = numpy.fromstring(r[3], dtype=numpy.float32)
      for i in xrange(0, len(ncamids)):
        camid = ncamids[i]
        if camid not in camera_ts_dict:
          rowid = len(camera_ts_dict)
          camera_ts_dict[camid] = [rowid, ncamts[i]]
          nobs.append(rowid)
        else:
          nobs.append(camera_ts_dict[camid][0])
      observations.append([r[0], buffer(msgpack.packb(pobs)), buffer(msgpack.packb(nobs))])

      count += 1
      if count % 1000000 == 0:
        print count
        conn.executemany("insert into observations (point_idx, pos_rowid_pack, neg_rowid_pack) values (?,?,?)", observations)
        conn.commit()
        print 'done with %d observations' % len(observations)
        observations = []

  camts = [[camera_ts_dict[camid][0], str(camid), int(camera_ts_dict[camid][1]), camera_urls[str(camid)]] for camid in camera_ts_dict]
  camera_ts_dict = None
  conn.executemany("insert into cameras (rowid, flickrid, timestamp, url) values (?,?,?,?)", camts)
  conn.commit()
  print 'done with %d cameras' % len(camts)
  conn.executemany("insert into observations (point_idx, pos_rowid_pack, neg_rowid_pack) values (?,?,?)", observations)
  conn.commit()
  print 'done with %d observations' % len(observations)

  print 'creating index...'
  conn.execute('create index oindex on observations(point_idx)')
  conn.commit()
  print 'done'

def main():
  createDb()
  migrate()

if __name__ == '__main__':
  main()
