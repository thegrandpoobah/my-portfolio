include_recipe 'aws'
include_recipe 'monit'

file '/usr/local/bin/my-portfolio' do
	content <<-EOF
#!/bin/bash
cd /srv/www/current
node server.js &
echo "$!" > /var/run/my-portfolio.pid
EOF
	mode '0744'
	owner 'root'
	group 'root'
end

monit_monitrc "my-portfolio" do
	variables({})
end

app = search("aws_opsworks_app").first

aws_s3_file '/tmp/my-portfolio.zip' do
	bucket 'my-portfolio-deploy'
	remote_path 'server.zip'
	aws_access_key app['app_source']['user']
	aws_secret_access_key app['app_source']['password']
end

directory '/srv/www/current' do 
	recursive true
	action :delete
end

directory '/srv/www/current' do
	recursive true
	action :create
	owner 'root'
	group 'root'
end

directory '/srv/www/shared' do
	recursive true
	action :create
	owner 'root'
	group 'root'
end

execute 'unzip package' do
	command 'unzip /tmp/my-portfolio.zip -d /srv/www/current'
end

execute 'npm install' do
	command '(cd /srv/www/current && npm install --production)'
end

template '/srv/www/shared/app.env' do
	source "app.env.erb"
	mode 0770
	owner 'root'
	group 'root'
	variables(
		:environment => app['environment']
	)
end

execute 'restart my-portfolio' do
	command 'monit restart my-portfolio'
	returns [0, 1]
end

execute 'generate first certificate' do
	command "/usr/bin/certbot certonly --webroot -w /srv/www/current/public -d #{node['cert_domain']} --non-interactive --agree-tos --email #{node['cert_email']} --rsa-key-size 4096 --post-hook \"ln --force --symbolic /etc/letsencrypt/live/#{node['cert_domain']}/fullchain.pem /vol/db/localhost.crt; ln --force --symbolic /etc/letsencrypt/live/#{node['cert_domain']}/privkey.pem /vol/db/localhost.key; monit restart my-portfolio\""
end
