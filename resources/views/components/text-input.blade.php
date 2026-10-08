@props(['disabled' => false])

<input @disabled($disabled) {{ $attributes->merge(['class' => 'border-gray-300 focus:border-portal-accent focus:ring-portal-accent rounded-md shadow-sm']) }}>
