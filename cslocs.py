import pandas as pd
import numpy as np
import os

data_abspath = os.path.join(os.getcwd(),'data')
cs_file = os.listdir(data_abspath)
cs_file = [os.path.join(data_abspath,x) for x in cs_file if x.endswith('.parquet')]

cs_pd = pd.read_parquet(cs_file)

# print(cs_pd.columns)
cs_data = cs_pd[['latitude','longitude','cp_id_str','connector_id', 'Power_kW','City','site']]


city_column_inputs = sorted(map(str,cs_data.City.unique()))
qs = ['Glasgow', 'Glasgow ', 'Glasgow City']
glasgow_cs_data = cs_data[cs_data['City'].str.contains('|'.join(qs))]

unique_glasgow_cs_locs = glasgow_cs_data.groupby(['latitude','longitude','cp_id_str','Power_kW','connector_id']).size().reset_index().rename(columns={0:'session_count'})

# print(cs_data.head(5))
# print(unique_glasgow_cs_locs)

unique_glasgow_cs_locs.to_csv(os.path.join(data_abspath,'glasgow_chargers.csv'), sep='\t', encoding='utf-8', index=False)