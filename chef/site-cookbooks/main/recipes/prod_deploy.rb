include_recipe 'aws'

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

app = search("aws_opsworks_app").first

aws_s3_file '/tmp/my-portfolio.zip' do
	bucket 'my-portfolio-deploy'
	remote_path 'server.zip'
	aws_access_key app['app_source']['user']
	aws_secret_access_key app['app_source']['password']
end

execute 'shutdown my-portfolio' do
	command 'monit stop my-portfolio'
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

execute 'start up my-portfolio' do
	command 'monit start my-portfolio'
end

