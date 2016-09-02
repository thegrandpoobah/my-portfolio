include_recipe 'monit'

package 'zip'

monit_monitrc "my-portfolio" do
  variables({})
end

cron "store account mv" do
  minute "00"
  hour "23"
  weekday "1-5"

  program = [
    "cd /srv/www/current",
    "source /srv/www/shared/app.env",
    "/usr/bin/env NODE_PATH=#/srv/www/current/node_modules:/srv/www/current /usr/local/bin/node cron/storeaccountmv.js >> /var/log/my-portfolio-cron.log 2>&1"
  ].join ' ; '

  command "/bin/bash -c '#{program}'"
end
