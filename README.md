# Temporary Parser

## Requirements
1. compareReports.json
1. node.js

The SQL query to output the compareReports.json is as follows:


    SELECT users.data, users.customer_id, c.customer_name, c.customer_id FROM auth0_users users LEFT JOIN customers c
           ON users.customer_id=c.customer_id

## Output

This script will output the following files:

- **allReports.json**: This is a compliation of all compare reports in JSON format
- **maxComparators.json**: This is a compilation of all compare reports that exceed the maxComparator param (currently 15).
- **maxMultiSelects.json**: This is a compilation of all compare reports that exceed the maxSelects param (currently 2).

- **errors.json**: Any errors that were generated when parsing the compareReports.json file.
