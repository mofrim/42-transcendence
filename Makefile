# -----------------------=[ ft_transcendence Makefile ]=---------------------- #

# some colors for the log msgs
GRN = \e[0;32m
RED = \e[1;31m
WHT = \e[1;37m
GRE = \e[37m
YLW = \e[1;93m
RST = \e[0m
MSGOPN = $(YLW)--(($(GRN)
MSGEND = $(YLW)))--$(RST)

# detect / set correct echo cmd
HOST = $(shell hostname)
ifeq ($(findstring wolfsburg,$(HOST)), wolfsburg)
	ECHO = echo
	ECHON = echo -n
else
	ECHO = echo -e
	ECHON = echo -en
endif

# logmsg makefile functions
log_msg_start = @$(ECHO) "\n$(MSGOPN) $(1) $(MSGEND)"
log_msg_mid = @$(ECHO) "$(MSGOPN) $(1) $(MSGEND)"
log_msg_end = @$(ECHO) "$(MSGOPN) $(1) $(MSGEND)\n"
log_msg_single = @$(ECHO) "\n$(MSGOPN) $(1) $(MSGEND)\n"

# output coloring
output_color_grey = @$(ECHON) "$(GRE)"
output_colr_reset =  @$(ECHON) "$(RST)"

all: .certs
	$(call log_msg_single,Launching ftr using docker compose..)
	docker compose up --build

dock-clean:
	$(call log_msg_start,Cleaning docker containers...)
	$(output_color_grey)
	docker compose down
	$(call log_msg_end,Done.)

dock-fclean:
	$(call log_msg_start,Cleaning ALL runtime docker stuff...)
	$(output_color_grey)
	docker compose down -v
	$(call log_msg_end,Done.)

dock-backend:
	$(call log_msg_start,Launching ftr-backend using docker compose..)
	docker compose --project-directory ./backend up --build
	$(call log_msg_end,Done.)

dock-frontend:
	$(call log_msg_start,Launching ftr-frontend using docker compose..)
	docker compose --project-directory ./frontend up --build
	$(call log_msg_end,Done.)

backend-dev:
	$(call log_msg_start,Launching all backend for dev...)
	cd backend && docker compose -f ./compose-db.yaml up -d && npm run dev:all
	$(call log_msg_end,Done.)

.certs:
	touch .certs
	make certs

certs:
	$(call log_msg_start,Making & distributing certs...)
	cd tools && ./genTLSCerts.sh
	cp tools/nginx-server-key.pem rev-proxy/nginx/server-key.pem
	cp tools/nginx-server-cert.pem rev-proxy/nginx/server-cert.pem
	touch .certs
	$(call log_msg_end,Done.)

.phony: all dock-clean dock-fclean dock-backend dock-frontend backend-dev certs
