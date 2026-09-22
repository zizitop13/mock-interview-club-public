create table customer_orders (
    id bigint primary key
);

create table audit_events (
    order_id bigint primary key
);
