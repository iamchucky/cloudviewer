cloudviewer
===========

Quick Start
-----------

Download http://s3.amazonaws.com/kmatzen/times-square-v7.gz and place it in the root directory.

Build the sqlite db from the input data.
```
python migrate.py
```

Start the application.
```
python pointcloud.py
```

Open the URL in your browser.

By default not all cameras and points are loaded.  grep static/js/pointcloud.js for getJSON to see how data is requested in chunks.
