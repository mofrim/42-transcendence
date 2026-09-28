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

all:
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
	$(output_color_grey)
	docker compose --project-directory ./backend up --build
	$(call log_msg_end,Done.)

dock-frontend:
	$(call log_msg_start,Launching ftr-frontend using docker compose..)
	$(output_color_grey)
	docker compose --project-directory ./frontend up --build
	$(call log_msg_end,Done.)

dock-db:
	$(call log_msg_start,Launching all backend for dev...)
	$(output_color_grey)
	cd backend && docker compose -f ./compose-db.yaml up -d
	$(call log_msg_end,Done.)

dock-db-clean: dock-db-down
	$(call log_msg_start,Cleaning ftr-db...)
	$(output_color_grey)
	docker volume rm -f ftr-db
	$(call log_msg_end,Done.)

dock-db-re: dock-db-down dock-db-clean dock-db

dock-re:
	$(call log_msg_start,Compose down...)
	@make --no-print-directory dock-clean
	$(call log_msg_mid,Resetting DB...)
	@make --no-print-directory dock-db-clean
	$(call log_msg_mid,Compose up...)
	@make --no-print-directory all
	$(call log_msg_end,Done.)

dock-db-down:
	$(call log_msg_start,Shutting down DB...)
	$(output_color_grey)
	cd backend && docker compose -f ./compose-db.yaml down
	$(call log_msg_end,Done.)

backend-dev:
	$(call log_msg_start,Launching all backend for dev...)
	$(output_color_grey)
	cd backend && docker compose -f ./compose-db.yaml up -d && npm run dev:all
	$(call log_msg_end,Done.)

frontend-dev:
	$(call log_msg_start,Launching frontend for dev...)
	$(output_color_grey)
	npm run dev:frontend
	$(call log_msg_end,Done.)

# for Windows development
backend-dev-win:
	$(call log_msg_start,Launching all backend for dev-win...)
	cd backend && docker compose -f ./compose-db.yaml up -d
	cd backend && start powershell -NoExit -Command "npm --prefix .\src\conn-service run dev-win"
	cd backend && start powershell -NoExit -Command "npm --prefix .\src\auth-service run dev-win"
	cd backend && start powershell -NoExit -Command "npm --prefix .\src\user-service run dev-win"
	$(call log_msg_end,Done.)

.phony: all dock-clean dock-fclean dock-backend dock-frontend dock-db \
	dock-db-down backend-dev certs dock-re
