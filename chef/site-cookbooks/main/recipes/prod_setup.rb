include_recipe 'nodejs::nodejs_from_package'
include_recipe 'monit'

package 'zip'
package 'sqlite3'
