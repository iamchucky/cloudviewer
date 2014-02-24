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

def createDb():
  conn.execute('create table if not exists time_observations(' +
      'positives_str blob not null,' +
      'positive_camera_ids_str blob not null,' +
      'negatives_str blob not null,' +
      'negative_camera_ids_str blob not null,' +
      'idx integer not null primary key)')
  conn.commit()

def filterNone(objs):
  return [obj for obj in objs if None not in obj and not (type(obj) is float and len(filter(isnan, obj)) > 0)]

def migrate():
  observations = []
  count = 0
  with open(pack_file, 'rb') as rf:
    for r in msgpack.Unpacker(rf):
      observations.append([r[0], buffer(r[1]), buffer(r[2]), buffer(r[3]), buffer(r[4])])
      count += 1
      if len(observations) >= 400000:
        print '%d observations' % count
        conn.executemany("insert into time_observations (idx, positives_str, positive_camera_ids_str, negatives_str, negative_camera_ids_str) values (?,?,?,?,?)", observations)
        observations = []
        conn.commit()
        print 'done commit'
    print '%d observations' % count
    conn.executemany("insert into time_observations (idx, positives_str, positive_camera_ids_str, negatives_str, negative_camera_ids_str) values (?,?,?,?,?)", observations)
    observations = []
    conn.commit()
    print 'done commit'

def main():
  createDb()
  migrate()

if __name__ == '__main__':
  main()
