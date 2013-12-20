import sqlite3
import gzip
import msgpack
from math import isnan

conn = sqlite3.connect('times-square-v7.db')
times_square = None

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
	conn.commit()

def filterNone(objs):
	return [obj for obj in objs if None not in obj and len(filter(isnan, obj)) == 0]

def loadPoints():
	global times_square
	with gzip.open('times-square-v7.gz', 'rb') as f:
		times_square = msgpack.unpackb(f.read())

def migrate():
	global times_square
# cameras
	cameras = filterNone(times_square['cameras']['attributes'])
	print cameras[0]
	print len(cameras)
	conn.executemany("insert into cameras (f,k1,k2,R11,R12,R13,R21,R22,R23,R31,R32,R33,t1,t2,t3,fovy,aspect) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", cameras)
# points
	points = filterNone([x[:6]+x[9:] for x in times_square['points']['attributes']])
	print len(points)
	conn.executemany("insert into points (x,y,z,r,g,b,tmin,tmax,source,idx) values (?,?,?,?,?,?,?,?,?,?)", points)
# commit
	conn.commit()

def main():
	loadPoints()
	createDb()
	migrate()

if __name__ == '__main__':
	main()
