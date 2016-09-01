include_recipe 'monit'

monit_monitrc "my-portfolio" do
  variables({})
end
