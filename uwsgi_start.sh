#!/bin/bash

touch /tmp/cloudviewer.sock
chmod www-data:www-data /tmp/cloudviewer.sock
uwsgi --socket /tmp/cloudview.sock --module pointcloud --callab app --async 64 --ugreen
