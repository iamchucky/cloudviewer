#!/bin/bash

uwsgi --socket 127.0.0.1:4242 --module pointcloud --callab app --async 64 --ugreen  
