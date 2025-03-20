# globalping
##### Make local
Make de image local

    docker-compose -f docker-compose-local.yml build globalping

To start containers:

    docker-compose -f docker-compose-local.yml up -d

To stop containers:

    docker-compose -f docker-compose-local.yml down

Make de image

    docker build  --no-cache -t ping ./

    Tag
    docker tag ping diegoneumann/ping:latest

    Deploy image dockerhub

    docker push diegoneumann/ping:latest


