#!/bin/bash
cd /srv/www/current
node server.js &
echo "$!" > /var/run/my-portfolio.pid
                                                                                   