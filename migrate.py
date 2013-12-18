import sqlite3
import gzip
import msgpack

conn = sqlite3.connect('times-square-v5.db')
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
	conn.commit()

def loadPoints():
	global times_square
	with gzip.open('times-square-v5.gz', 'rb') as f:
		times_square = msgpack.unpackb(f.read())
		print times_square['points']['fields']

def migrate():
	global times_square
	points = [x[:6]+x[9:] for x in times_square['points']['attributes']]
	conn.executemany("insert into points (x,y,z,r,g,b,tmin,tmax,source,idx) values (?,?,?,?,?,?,?,?,?,?)", points)
	conn.commit()

def main():
	loadPoints()
	createDb()
	migrate()
	pass

if __name__ == '__main__':
	main()
