<button {{ $attributes->merge(['type' => 'submit', 'class' => 'inline-flex items-center px-4 py-2 bg-portal-accent border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-portal-accent-hover focus:bg-portal-accent-hover active:bg-portal-accent-hover focus:outline-none focus:ring-2 focus:ring-portal-accent focus:ring-offset-2 transition ease-in-out duration-150']) }}>
    {{ $slot }}
</button>
