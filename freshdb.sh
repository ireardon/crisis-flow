#! /bin/bash

rm sessions.db
rm data.db
touch sessions.db
touch data.db
touch sq3cmd
cat schema.sql > sq3cmd
echo '.quit' >> sq3cmd
cat sq3cmd | sqlite3 data.db
rm sq3cmd
echo 'Database recreated!'
