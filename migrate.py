import sqlite3
import gzip
import msgpack

conn = sqlite3.connect('times-square.db')
c = conn.cursor()
times_square = None

def createDb():
	conn.execute('create table if not exists points(' +
			'x integer not null,' +
			'y integer not null,' +
			'z integer not null,' +
			'r integer not null,' +
			'g integer not null,' +
			'b integer not null)')
	conn.commit()

def loadPoints():
	global times_square
	with gzip.open('./static/data/times-square.pack.gz', 'rb') as f:
		times_square = msgpack.unpackb(f.read())

def migrate():
	global times_square
	points = [tuple(x[:6]) for x in times_square['attributes']]
	conn.executemany("insert into points (x,y,z,r,g,b) values (?,?,?,?,?,?)", points)
	conn.commit()

def main():
	createDb()
	loadPoints()
	migrate()
	pass

if __name__ == '__main__':
	main()
