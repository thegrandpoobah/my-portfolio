include_recipe 'nodejs'
include_recipe 'monit'
include_recipe 'openssl'
include_recipe 'logrotate'

package 'zip'
package 'sqlite3'
package 'htop'

file '/vol/db/localhost.crt' do
  action :delete
end

file '/vol/db/localhost.key' do
  action :delete
end

openssl_x509 '/vol/db/localhost.crt' do
  common_name 'localhost'
  org 'My Portfolio'
  org_unit ''
  key_length 4096
  country 'CA'
end

remote_file '/usr/bin/certbot' do
  source 'https://dl.eff.org/certbot-auto'
  owner 'root'
  group 'root'
  mode '0755'
  action :create
end

cron 'store account mv' do
  minute "00"
  hour "23"
  weekday "1-5"

  program = [
    "cd /srv/www/current",
    "source /srv/www/shared/app.env",
    "/usr/bin/env NODE_PATH=#/srv/www/current/node_modules:/srv/www/current /usr/bin/node cron/storeaccountmv.js >> /var/log/my-portfolio-cron.log 2>&1"
  ].join ' ; '

  command "/bin/bash -c '#{program}'"
end

cron 'update ssl certificate' do
  minute "27" # this should be random
  hour "11,23"
  weekday "*"

  command "/usr/bin/certbot renew --quiet --no-self-upgrade --post-hook \"ln --force --symbolic /etc/letsencrypt/live/#{node['cert_domain']}/fullchain.pem /vol/db/localhost.crt; ln --force --symbolic /etc/letsencrypt/live/#{node['cert_domain']}/privkey.pem /vol/db/localhost.key; monit restart my-portfolio\""
end

logrotate_app 'my-portfolio' do
  path ['/var/log/my-portfolio.log', '/var/log/my-portfolio-cron.log']
  frequency 'daily'
  rotate 30
  create '644 root adm'
  options ['missingok', 'compress', 'delaycompress', 'notifempty']
end
