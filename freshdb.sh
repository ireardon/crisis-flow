#! /bin/bash

rm chatroom.db
touch chatroom.db
touch sq3cmd
cat schema.sql > sq3cmd
echo '.quit' >> sq3cmd
cat sq3cmd | sqlite3 chatroom.db
rm sq3cmd
echo 'Database recreated!'
